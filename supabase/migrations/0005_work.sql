-- 0005: Karbon work items assigned to the admin (the Work list)
create table if not exists karbon_work_items (
  karbon_key     text primary key,
  entity_id      uuid references entities(id) on delete cascade,
  title          text not null,
  work_type      text,
  tax_year       int,
  return_type    text,
  primary_status text,
  secondary_status text,
  due_date       date,
  assignee_email text,
  synced_at      timestamptz not null default now()
);
alter table karbon_work_items enable row level security;
create policy read_all on karbon_work_items for select using (is_firm_user());
grant select on karbon_work_items to authenticated;
grant all on karbon_work_items to service_role;

insert into app_settings (key, value, note) values
  ('karbon_admin_email', 'admin@schapiracpa.com', 'Karbon work items assigned to this user show in the Work list')
on conflict (key) do nothing;
