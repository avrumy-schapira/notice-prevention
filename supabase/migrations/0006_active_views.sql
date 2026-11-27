-- 0006: show only active Karbon clients (Inactive and Internal are hidden)
create or replace function is_active_status(s text) returns boolean language sql immutable as $$
  select coalesce(s, '') not in ('Inactive', 'Internal')
$$;

create or replace view client_group_list with (security_invoker = on) as
select g.id, g.name, g.karbon_status,
       count(e.id) filter (where is_active_status(e.karbon_status)) as entity_count
from client_groups g
left join entities e on e.client_group_id = g.id
where coalesce(g.karbon_status, '') <> 'Inactive'
group by g.id
having count(e.id) filter (where is_active_status(e.karbon_status)) > 0;

grant select on client_group_list to authenticated;
grant execute on function is_active_status(text) to authenticated;
