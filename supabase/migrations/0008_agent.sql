-- 0008: UltraTax agent <-> site
-- The agent logs in with no user account: it calls 3 functions with the anon (publishable) key
-- plus an agent secret. Only the secret's bcrypt hash is stored here.

create table if not exists agent_jobs (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references profiles(id),
  filing_id      uuid not null references filings(id) on delete cascade,
  client_id      text not null check (client_id !~ ' - '),            -- IDs with a suffix are not entities
  return_type    text not null check (return_type in ('1040', '1065', '1120', '1120-S', '1041')),
  stage          text not null check (stage in ('extension', 'return')),
  kind           text not null default 'pull' check (kind in ('pull', 'final_pull', 'set_bank')),
  payload        jsonb,                                                -- set_bank later
  status         text not null default 'waiting' check (status in ('waiting', 'running', 'done', 'error')),
  started_at     timestamptz,
  finished_at    timestamptz,
  agent_machine  text,
  result         jsonb,                                                -- bank numbers masked to last 4
  error          text
);
create index if not exists agent_jobs_waiting on agent_jobs (created_at) where status = 'waiting';
create unique index if not exists agent_jobs_one_active on agent_jobs (filing_id) where status in ('waiting', 'running');

alter table agent_jobs enable row level security;
create policy read_all on agent_jobs for select using (is_firm_user());
create policy admin_insert on agent_jobs for insert with check (my_role() = 'admin' and status = 'waiting');
grant select, insert on agent_jobs to authenticated;
grant all on agent_jobs to service_role;
grant usage, select on all sequences in schema public to authenticated;

-- Bank numbers read by the agent, encrypted (one row per department / screen / unit)
create table if not exists filing_banks (
  id            uuid primary key default gen_random_uuid(),
  filing_id     uuid not null references filings(id) on delete cascade,
  department    text not null,
  screen        text,
  screen_no     int,
  unit          int,
  routing_enc   text,
  account_enc   text,
  account_type  text,
  last4         text,
  pulled_at     timestamptz not null default now(),
  unique (filing_id, department, screen_no, unit)
);
alter table filing_banks enable row level security;
create policy read_all on filing_banks for select using (is_firm_user());
grant select on filing_banks to authenticated;
grant all on filing_banks to service_role;

alter table filings add column if not exists states_filed text[];
alter table filings add column if not exists last_job_id bigint;

-- Agent identity (one row)
create table if not exists agent_state (
  id           int primary key default 1 check (id = 1),
  secret_hash  text,
  last_seen    timestamptz,
  machine      text,
  version      text
);
insert into agent_state (id) values (1) on conflict do nothing;
alter table agent_state enable row level security;           -- no policies: nobody reads it directly
revoke all on agent_state from anon, authenticated;

create or replace function agent_check(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select secret_hash is not null and extensions.crypt(coalesce(p_secret, ''), secret_hash) = secret_hash
                   from agent_state where id = 1), false)
$$;

-- Run once in the SQL editor: returns a new secret (shown only there) and stores its hash
create or replace function agent_new_secret() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  update agent_state set secret_hash = extensions.crypt(s, extensions.gen_salt('bf', 10)) where id = 1;
  return s;
end $$;

-- Site: when the agent was last seen
create or replace function agent_last_seen() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('last_seen', last_seen, 'machine', machine) from agent_state where id = 1
$$;

---------------------------------------------------------------- the 3 agent functions
create or replace function agent_heartbeat(p_secret text, p_machine text, p_version text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not agent_check(p_secret) then raise exception 'agent not authorized' using errcode = '28000'; end if;
  update agent_state set last_seen = now(), machine = p_machine, version = coalesce(p_version, version) where id = 1;
  return jsonb_build_object('ok', true, 'server_time', now(), 'waiting', (select count(*) from agent_jobs where status = 'waiting'));
end $$;

create or replace function agent_claim_job(p_secret text, p_machine text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j agent_jobs;
begin
  if not agent_check(p_secret) then raise exception 'agent not authorized' using errcode = '28000'; end if;
  update agent_state set last_seen = now(), machine = p_machine where id = 1;
  -- a job stuck in running for 5 minutes goes back to the queue
  update agent_jobs set status = 'waiting', started_at = null, agent_machine = null
   where status = 'running' and started_at < now() - interval '5 minutes';
  select * into j from agent_jobs where status = 'waiting' order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update agent_jobs set status = 'running', started_at = now(), agent_machine = p_machine where id = j.id;
  return jsonb_build_object('job_id', j.id, 'filing_id', j.filing_id, 'client_id', j.client_id, 'return_type', j.return_type,
                            'stage', j.stage, 'kind', j.kind, 'payload', j.payload, 'created_at', j.created_at);
end $$;

create or replace function agent_finish_job(p_secret text, p_job_id bigint, p_result jsonb, p_error text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  j agent_jobs;
  masked jsonb := p_result;
  failed boolean := p_error is not null or coalesce(p_result->>'status', '') = 'error';
  d record; i record; dept_inputs jsonb; bank jsonb := '{}'::jsonb; k text;
begin
  if not agent_check(p_secret) then raise exception 'agent not authorized' using errcode = '28000'; end if;
  update agent_state set last_seen = now() where id = 1;
  select * into j from agent_jobs where id = p_job_id for update;
  if not found then raise exception 'job % not found', p_job_id; end if;
  if j.status <> 'running' then raise exception 'job % is %, not running', p_job_id, j.status; end if;

  -- Mask bank numbers in the stored JSON; keep the full numbers encrypted in filing_banks
  if jsonb_typeof(p_result->'departments') = 'object' then
    for d in select key, value from jsonb_each(p_result->'departments') loop
      dept_inputs := '[]'::jsonb;
      for i in select value as v, ord from jsonb_array_elements(coalesce(d.value->'inputs', '[]'::jsonb)) with ordinality as t(value, ord) order by ord loop
        if (i.v->>'label') in ('Routing transit number', 'Depositor account number', 'Account number') and coalesce(i.v->>'value', '') <> '' then
          k := d.key || '|' || coalesce(i.v->>'screenNo', '') || '|' || coalesce(i.v->>'unit', '');
          bank := jsonb_set(bank, array[k], coalesce(bank->k, jsonb_build_object('dept', d.key, 'screen', i.v->>'screen', 'screenNo', i.v->'screenNo', 'unit', i.v->'unit'))
                   || jsonb_build_object(case when i.v->>'label' = 'Routing transit number' then 'routing' else 'account' end, i.v->>'value'));
          dept_inputs := dept_inputs || jsonb_set(i.v, '{value}', to_jsonb('••••' || right(i.v->>'value', 4)));
        else
          if (i.v->>'label') = 'Type of account' and coalesce(i.v->>'value', '') <> '' then
            k := d.key || '|' || coalesce(i.v->>'screenNo', '') || '|' || coalesce(i.v->>'unit', '');
            bank := jsonb_set(bank, array[k], coalesce(bank->k, jsonb_build_object('dept', d.key, 'screen', i.v->>'screen', 'screenNo', i.v->'screenNo', 'unit', i.v->'unit'))
                     || jsonb_build_object('type', i.v->>'value'));
          end if;
          dept_inputs := dept_inputs || i.v;
        end if;
      end loop;
      masked := jsonb_set(masked, array['departments', d.key, 'inputs'], dept_inputs);
    end loop;
  end if;

  update agent_jobs set status = case when failed then 'error' else 'done' end, finished_at = now(),
         result = masked, error = case when failed then coalesce(p_error, p_result->>'error', 'error') end
   where id = j.id;

  if not failed then
    -- encrypted bank numbers for this filing (replaces the previous pull's)
    delete from filing_banks where filing_id = j.filing_id;
    insert into filing_banks (filing_id, department, screen, screen_no, unit, routing_enc, account_enc, account_type, last4)
    select j.filing_id, b->>'dept', b->>'screen', nullif(b->>'screenNo', '')::int, nullif(b->>'unit', '')::int,
           bank_enc(b->>'routing'), bank_enc(b->>'account'),
           case b->>'type' when '1' then 'savings' when '2' then 'checking' when '3' then 'ira' else b->>'type' end,
           right(b->>'account', 4)
      from jsonb_each(bank) as e(k, b)
     where coalesce(b->>'routing', '') <> '' or coalesce(b->>'account', '') <> '';

    update filings set
      last_pull_at = now(),
      final_pull_at = case when j.kind = 'final_pull' then now() else final_pull_at end,
      states_filed = (select array_agg(x) from jsonb_array_elements_text(coalesce(p_result->'statesFiled', '[]'::jsonb)) x),
      diagnostics = (select string_agg(dk.key || ': ' || (m->>'message'), E'\n')
                       from jsonb_each(coalesce(p_result->'diagnostics', '{}'::jsonb)) dk, jsonb_array_elements(dk.value) m),
      last_job_id = j.id
     where id = j.filing_id;
    insert into activity_log (filing_id, actor, action, details)
    values (j.filing_id, j.created_by, case when j.kind = 'final_pull' then 'final_pull_done' else 'pull_done' end,
            jsonb_build_object('job', j.id, 'machine', j.agent_machine));
  else
    insert into activity_log (filing_id, actor, action, details)
    values (j.filing_id, j.created_by, 'pull_failed', jsonb_build_object('job', j.id, 'error', coalesce(p_error, p_result->>'error')));
  end if;

  return jsonb_build_object('ok', true, 'job_id', j.id, 'status', case when failed then 'error' else 'done' end);
end $$;

-- Reveal for UltraTax bank numbers (logged like the others)
alter table bank_reveals add column if not exists filing_bank_id uuid references filing_banks(id) on delete set null;
create or replace function reveal_bank(p_kind text, p_id uuid, p_field text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v text;
begin
  if not is_firm_user() then raise exception 'not allowed'; end if;
  if p_kind = 'bank_account' then
    select case p_field when 'routing' then bank_dec(routing_enc) when 'account' then bank_dec(account_enc) end into v from bank_accounts where id = p_id;
    insert into bank_reveals (user_id, bank_account_id, field) values (auth.uid(), p_id, p_field);
  elsif p_kind = 'payment_line' then
    select case p_field when 'routing' then bank_dec(bank_routing_enc) when 'account' then bank_dec(bank_account_enc)
                        when 'new_routing' then bank_dec(new_routing_enc) when 'new_account' then bank_dec(new_account_enc) end
      into v from payment_lines where id = p_id;
    insert into bank_reveals (user_id, payment_line_id, field) values (auth.uid(), p_id, p_field);
  elsif p_kind = 'filing_bank' then
    select case p_field when 'routing' then bank_dec(routing_enc) when 'account' then bank_dec(account_enc) end into v from filing_banks where id = p_id;
    insert into bank_reveals (user_id, filing_bank_id, field) values (auth.uid(), p_id, p_field);
  else
    raise exception 'bad kind';
  end if;
  return v;
end $$;

-- Who may call what. Functions are executable by PUBLIC by default, so revoke first.
revoke all on function agent_check(text) from public, anon, authenticated;
revoke all on function agent_new_secret() from public, anon, authenticated;
revoke all on function agent_last_seen() from public, anon;
grant execute on function agent_last_seen() to authenticated;
revoke all on function agent_heartbeat(text, text, text) from public;
revoke all on function agent_claim_job(text, text) from public;
revoke all on function agent_finish_job(text, bigint, jsonb, text) from public;
grant execute on function agent_heartbeat(text, text, text) to anon, authenticated;
grant execute on function agent_claim_job(text, text) to anon, authenticated;
grant execute on function agent_finish_job(text, bigint, jsonb, text) to anon, authenticated;
