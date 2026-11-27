-- 0004: active filter, contact info, encrypted bank accounts, estimated payment plans

alter table client_groups add column if not exists karbon_status text;
alter table entities add column if not exists email text;
alter table entities add column if not exists phone text;

-------------------------------------------------------------------------------
-- Bank encryption. The key is generated inside the database and kept in
-- Supabase Vault; nobody types or sees it. Only these functions can use it.
-------------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'bank_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'bank_key', 'Encrypts client bank numbers');
  end if;
end $$;

create or replace function bank_key() returns text
language sql stable security definer set search_path = public, extensions as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'bank_key'
$$;
create or replace function bank_enc(p text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case when coalesce(p, '') = '' then null else encode(extensions.pgp_sym_encrypt(p, bank_key()), 'base64') end
$$;
create or replace function bank_dec(p text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case when p is null then null else extensions.pgp_sym_decrypt(decode(p, 'base64'), bank_key()) end
$$;
revoke all on function bank_key() from public, anon, authenticated;
revoke all on function bank_enc(text) from public, anon, authenticated;
revoke all on function bank_dec(text) from public, anon, authenticated;

create table if not exists bank_accounts (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  label         text,
  bank_name     text,
  routing_enc   text not null,
  account_enc   text not null,
  account_type  text not null check (account_type in ('checking', 'savings')),
  last4         text not null,
  source        text not null default 'staff' check (source in ('staff', 'client_modify', 'ultratax', 'scheduled_payments')),
  last_used_at  timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists bank_accounts_entity on bank_accounts (entity_id);
alter table bank_reveals add column if not exists bank_account_id uuid references bank_accounts(id) on delete set null;

-- ABA routing number check digit
create or replace function valid_routing(r text) returns boolean language sql immutable as $$
  select r ~ '^[0-9]{9}$' and (
    3 * (substr(r,1,1)::int + substr(r,4,1)::int + substr(r,7,1)::int) +
    7 * (substr(r,2,1)::int + substr(r,5,1)::int + substr(r,8,1)::int) +
        (substr(r,3,1)::int + substr(r,6,1)::int + substr(r,9,1)::int)) % 10 = 0
$$;

create or replace function save_bank_account(p_entity uuid, p_label text, p_bank_name text, p_routing text, p_account text, p_type text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not is_firm_user() then raise exception 'not allowed'; end if;
  if not valid_routing(p_routing) then raise exception 'Routing number is not valid'; end if;
  if p_account !~ '^[0-9]{4,17}$' then raise exception 'Account number must be 4 to 17 digits'; end if;
  insert into bank_accounts (entity_id, label, bank_name, routing_enc, account_enc, account_type, last4, created_by)
  values (p_entity, nullif(p_label, ''), nullif(p_bank_name, ''), bank_enc(p_routing), bank_enc(p_account), p_type, right(p_account, 4), auth.uid())
  returning id into v_id;
  insert into activity_log (entity_id, actor, action, details)
  values (p_entity, auth.uid(), 'bank_account_added', jsonb_build_object('last4', right(p_account, 4), 'type', p_type));
  return v_id;
end $$;

-- Reveal a full bank number. Every reveal is logged.
create or replace function reveal_bank(p_kind text, p_id uuid, p_field text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v text;
begin
  if not is_firm_user() then raise exception 'not allowed'; end if;
  if p_kind = 'bank_account' then
    select case p_field when 'routing' then bank_dec(routing_enc) when 'account' then bank_dec(account_enc) end
      into v from bank_accounts where id = p_id;
    insert into bank_reveals (user_id, bank_account_id, field) values (auth.uid(), p_id, p_field);
  elsif p_kind = 'payment_line' then
    select case p_field
             when 'routing' then bank_dec(bank_routing_enc) when 'account' then bank_dec(bank_account_enc)
             when 'new_routing' then bank_dec(new_routing_enc) when 'new_account' then bank_dec(new_account_enc) end
      into v from payment_lines where id = p_id;
    insert into bank_reveals (user_id, payment_line_id, field) values (auth.uid(), p_id, p_field);
  else
    raise exception 'bad kind';
  end if;
  return v;
end $$;

-------------------------------------------------------------------------------
-- Estimated payment plans
-------------------------------------------------------------------------------
create table if not exists payment_plans (
  id                     uuid primary key default gen_random_uuid(),
  entity_id              uuid not null references entities(id) on delete cascade,
  tax_year               int not null,
  department             text not null,          -- IRS, NYS (incl. NYC), NJ, PTET NYS, PTET NYC, or another state
  schedule               text not null check (schedule in ('individual', 'corporation', 'ptet')),
  frequency              text not null default 'quarterly' check (frequency in ('quarterly', 'monthly')),
  pay_day                int not null default 15 check (pay_day between 1 and 28),
  basis                  text not null,          -- how the target was set (safe harbor rule or custom)
  prior_year_tax         numeric(14,2),
  prior_year_agi         numeric(14,2),
  married_separate       boolean not null default false,
  withholding            numeric(14,2) not null default 0,
  overpayment_applied    numeric(14,2) not null default 0,
  current_year_estimate  numeric(14,2),
  target_amount          numeric(14,2) not null,
  who_pays               text not null default 'richelle' check (who_pays in ('richelle', 'client')),
  bank_account_id        uuid references bank_accounts(id) on delete set null,
  show_savings           boolean not null default true,
  notes                  text,
  created_by             uuid references profiles(id),
  created_at             timestamptz not null default now(),
  unique (entity_id, tax_year, department)
);

create table if not exists plan_payments (
  id                      uuid primary key default gen_random_uuid(),
  plan_id                 uuid not null references payment_plans(id) on delete cascade,
  seq                     int not null,
  due_date                date not null,          -- moved to the next business day
  installment_deadline    date not null,          -- official quarterly due date this payment counts toward
  amount                  numeric(14,2) not null,
  who_pays                text not null check (who_pays in ('richelle', 'client')),
  status                  text not null default 'scheduled' check (status in ('scheduled', 'made', 'missed')),
  confirmation_received   boolean not null default false,   -- client pays himself: counts only with proof
  completed_at            timestamptz,
  completed_by            uuid references profiles(id),
  reminder_sent_at        timestamptz,
  note                    text
);
create index if not exists plan_payments_due on plan_payments (due_date, status);

create table if not exists app_settings (
  key    text primary key,
  value  text not null,
  note   text
);
insert into app_settings (key, value, note) values
  ('underpayment_rate', '7', 'IRS underpayment interest rate, % per year (used for the penalty-savings number)')
on conflict (key) do nothing;

alter table bank_accounts  enable row level security;
alter table payment_plans  enable row level security;
alter table plan_payments  enable row level security;
alter table app_settings   enable row level security;

create policy read_all on bank_accounts for select using (is_firm_user());
create policy staff_update on bank_accounts for update using (is_firm_user()) with check (is_firm_user());
create policy staff_delete on bank_accounts for delete using (is_firm_user());
create policy read_all on payment_plans for select using (is_firm_user());
create policy staff_write on payment_plans for all using (is_firm_user()) with check (is_firm_user());
create policy read_all on plan_payments for select using (is_firm_user());
create policy staff_write on plan_payments for all using (is_firm_user()) with check (is_firm_user());
create policy read_all on app_settings for select using (is_firm_user());
create policy admin_write on app_settings for all using (my_role() = 'admin') with check (my_role() = 'admin');

grant select, update, delete on bank_accounts to authenticated;
grant select, insert, update, delete on payment_plans, plan_payments to authenticated;
grant select, insert, update on app_settings to authenticated;
grant all on bank_accounts, payment_plans, plan_payments, app_settings to service_role;
grant execute on function save_bank_account(uuid, text, text, text, text, text) to authenticated;
grant execute on function reveal_bank(text, uuid, text) to authenticated;
grant execute on function valid_routing(text) to authenticated;

