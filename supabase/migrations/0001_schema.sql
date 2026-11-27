-- Notice Prevention / Payment & Filing Control System
-- Schema v1. Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

-------------------------------------------------------------------------------
-- Users and roles
-------------------------------------------------------------------------------
create type app_role as enum ('admin', 'manager', 'staff');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        app_role not null default 'staff',
  created_at  timestamptz not null default now()
);

-- Only schapiracpa.com accounts can sign up. Everyone starts as staff.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) not like '%@schapiracpa.com' then
    raise exception 'Only schapiracpa.com accounts can sign in';
  end if;
  insert into profiles (id, email, full_name)
  values (new.id, lower(new.email), new.raw_user_meta_data->>'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_firm_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid())
$$;

-------------------------------------------------------------------------------
-- Client groups and entities (from Karbon)
-------------------------------------------------------------------------------
create table client_groups (
  id              uuid primary key default gen_random_uuid(),
  karbon_key      text unique,
  name            text not null,
  last_synced_at  timestamptz
);

create table entities (
  id                 uuid primary key default gen_random_uuid(),
  client_group_id    uuid references client_groups(id) on delete set null,
  karbon_key         text unique,
  name               text not null,
  client_id          text unique,          -- UltraTax client ID = Karbon "Client Identifier"
  return_type        text check (return_type in
                       ('1040','1040-X','1040-SR','1041','1065','1120','1120-S','990')),
  assigned_preparer  text,                 -- from Karbon
  karbon_url         text,
  last_synced_at     timestamptz
);
create index on entities (client_group_id);

-- Email recipients saved per entity (admin enters on first send)
create table email_recipients (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  email       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  unique (entity_id, email)
);

-- Last used bank per entity (client Modify submissions + scheduled-payments system)
create table last_used_banks (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  routing_enc   text,                      -- encrypted
  account_enc   text,                      -- encrypted
  account_type  text check (account_type in ('checking','savings')),
  last4         text,
  source        text check (source in ('client_modify','scheduled_payments','manual')),
  recorded_at   timestamptz not null default now()
);
create index on last_used_banks (entity_id, recorded_at desc);

-- Prior-year amounts per department / tax type (one-time UltraTax data mining)
create table prior_year_amounts (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  tax_year    int not null,
  department  text not null check (department in ('IRS','NYS','NYC','NJ')),
  tax_type    text not null,               -- e.g. 'NJ filing fee', 'NJ nonresident partner tax', 'NYC UBT'
  amount      numeric(14,2) not null,
  source      text not null default 'data_mining',
  unique (entity_id, tax_year, department, tax_type)
);

-------------------------------------------------------------------------------
-- Filings: one row per entity, tax year, stage
-------------------------------------------------------------------------------
create type filing_stage as enum ('extension', 'return');
create type filing_status as enum (
  'not_started',
  'pulled_flags_open',
  'ready_to_email',
  'emailed_waiting',
  'client_confirmed',
  'client_modified_ach',
  'client_modified_method',
  'filed'
);

create table filings (
  id                      uuid primary key default gen_random_uuid(),
  entity_id               uuid not null references entities(id) on delete cascade,
  tax_year                int not null,
  stage                   filing_stage not null,
  status                  filing_status not null default 'not_started',
  last_pull_at            timestamptz,
  diagnostics             text,            -- UltraTax diagnostics text from last pull
  date_return_filed       date,            -- UltraTax Pen screen
  email_sent_at           timestamptz,
  email_sent_by           uuid references profiles(id),
  client_link_token       text unique,
  client_link_expires_at  timestamptz,
  client_responded_at     timestamptz,
  final_pull_at           timestamptz,
  filed_at                timestamptz,
  filed_by                uuid references profiles(id),
  created_at              timestamptz not null default now(),
  unique (entity_id, tax_year, stage)
);
create index on filings (status);

-------------------------------------------------------------------------------
-- Payment lines: one row per department + tax type (+ owner) on a filing
-------------------------------------------------------------------------------
create table payment_lines (
  id                   uuid primary key default gen_random_uuid(),
  filing_id            uuid not null references filings(id) on delete cascade,
  department           text not null check (department in ('IRS','NYS','NYC','NJ')),
  tax_type             text not null,      -- e.g. 'NJ-1065 filing fee', 'NJ-CBT-1065 nonresident tax', 'NYC UBT', 'CT-3'
  owner                text check (owner in ('T','S')),   -- 1040 NYC UBT per unit

  -- Pulled from UltraTax
  direction            text check (direction in ('due','refund')),
  amount               numeric(14,2),      -- excludes penalties and interest
  efile_on             boolean,
  efile_suppressed     boolean,
  efw_enabled          boolean,
  method_code          text,               -- raw UltraTax code
  method               text check (method in ('efw','eft','online','voucher','check','credit_card','none')),
  credit_card_marked   boolean,
  payment_suppressed   boolean,
  superseded           boolean,
  payment_date         date,               -- blank kept blank; meaning depends on department
  bank_routing_enc     text,
  bank_account_enc     text,
  bank_type            text,
  bank_last4           text,
  bank_source          text,               -- 'federal' or state screen override, e.g. 'NYBank'
  bank_verified_code   text,               -- 1040: '5' = proforma only
  bank_non_us          boolean,
  prior_overpayment    numeric(14,2),      -- extension only
  estimates_paid       numeric(14,2),      -- extension only
  extension_payment    numeric(14,2),      -- extension only
  pulled_at            timestamptz,

  -- Client response
  sent_amount          numeric(14,2),
  sent_method          text,
  sent_bank_last4      text,
  sent_payment_date    date,
  response             text not null default 'waiting' check (response in ('waiting','confirmed','modified')),
  new_method           text check (new_method in ('efw','credit_card','check')),
  new_routing_enc      text,
  new_account_enc      text,
  new_account_type     text check (new_account_type in ('checking','savings')),
  new_last4            text,
  responded_at         timestamptz,
  entered_in_ultratax_at timestamptz,

  -- Payment tracking (reminders + confirmation)
  reminder_sent_at       timestamptz,
  confirmation_sent_at   timestamptz,
  client_paid_response   text check (client_paid_response in ('paid','not_paid')),
  client_paid_at         timestamptz,
  manual_payment_needed  boolean not null default false,
  payment_status         text not null default 'pending'
                           check (payment_status in ('pending','verified','manual_paid')),
  payment_status_at      timestamptz,
  payment_status_by      uuid references profiles(id),

  created_at           timestamptz not null default now()
);
create index on payment_lines (filing_id);
create index on payment_lines (payment_date);

-------------------------------------------------------------------------------
-- Flags from checks + "Preparer approved in Karbon"
-------------------------------------------------------------------------------
create table flags (
  id               uuid primary key default gen_random_uuid(),
  filing_id        uuid not null references filings(id) on delete cascade,
  payment_line_id  uuid references payment_lines(id) on delete cascade,
  check_code       text not null,
  message          text not null,
  status           text not null default 'open' check (status in ('open','approved','cleared')),
  preparer_name    text,
  approved_by      uuid references profiles(id),
  approved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index on flags (filing_id, status);

-------------------------------------------------------------------------------
-- Logs
-------------------------------------------------------------------------------
create table activity_log (
  id          bigint generated always as identity primary key,
  entity_id   uuid references entities(id) on delete cascade,
  filing_id   uuid references filings(id) on delete cascade,
  actor       uuid references profiles(id),
  action      text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index on activity_log (filing_id, created_at desc);

create table bank_reveals (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references profiles(id),
  payment_line_id     uuid references payment_lines(id) on delete set null,
  last_used_bank_id   uuid references last_used_banks(id) on delete set null,
  field               text not null,       -- 'routing' / 'account' / 'new_routing' / ...
  created_at          timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- Row-level security
-- Firm users read everything. Writes by the agent, sync and email functions
-- use the service key on the server (bypasses RLS).
-------------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table client_groups       enable row level security;
alter table entities            enable row level security;
alter table email_recipients    enable row level security;
alter table last_used_banks     enable row level security;
alter table prior_year_amounts  enable row level security;
alter table filings             enable row level security;
alter table payment_lines       enable row level security;
alter table flags               enable row level security;
alter table activity_log        enable row level security;
alter table bank_reveals        enable row level security;

create policy read_all on profiles           for select using (is_firm_user());
create policy read_all on client_groups      for select using (is_firm_user());
create policy read_all on entities           for select using (is_firm_user());
create policy read_all on email_recipients   for select using (is_firm_user());
create policy read_all on last_used_banks    for select using (is_firm_user());
create policy read_all on prior_year_amounts for select using (is_firm_user());
create policy read_all on filings            for select using (is_firm_user());
create policy read_all on payment_lines      for select using (is_firm_user());
create policy read_all on flags              for select using (is_firm_user());
create policy read_all on activity_log       for select using (is_firm_user());
create policy read_own on bank_reveals       for select using (user_id = auth.uid() or my_role() in ('admin','manager'));

-- Admin: full write on workflow tables
create policy admin_write on filings          for all using (my_role() = 'admin') with check (my_role() = 'admin');
create policy admin_write on flags            for all using (my_role() = 'admin') with check (my_role() = 'admin');
create policy admin_write on email_recipients for all using (my_role() = 'admin') with check (my_role() = 'admin');
create policy admin_write on payment_lines    for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- Staff check-offs on payment tracking go through this function (only those columns)
create or replace function set_payment_status(p_line uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_firm_user() then raise exception 'not allowed'; end if;
  if p_status not in ('pending','verified','manual_paid') then raise exception 'bad status'; end if;
  update payment_lines
     set payment_status = p_status,
         payment_status_at = now(),
         payment_status_by = auth.uid(),
         manual_payment_needed = case when p_status = 'manual_paid' then false else manual_payment_needed end
   where id = p_line;
  insert into activity_log (filing_id, actor, action, details)
  select filing_id, auth.uid(), 'payment_status', jsonb_build_object('line', p_line, 'status', p_status)
    from payment_lines where id = p_line;
end $$;

-- Anyone signed in can write the activity log as themselves
create policy insert_own on activity_log for insert with check (actor = auth.uid());

-- Only admins change roles
create policy admin_roles on profiles for update using (my_role() = 'admin') with check (my_role() = 'admin');
