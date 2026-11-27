-- Karbon sync support (applied 11/27)
alter table entities add column if not exists karbon_status text;  -- Karbon ContactType: Client, Inactive, ...

-- The sync function writes with the service role; this project doesn't grant it by default
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated;
