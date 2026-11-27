-- 0007: Work list driven by Karbon status (Send Return / Ext to Client -> until Completed)
alter table karbon_work_items add column if not exists stage text check (stage in ('extension', 'return'));
alter table karbon_work_items add column if not exists first_seen_at timestamptz not null default now();
delete from app_settings where key = 'karbon_admin_email';
