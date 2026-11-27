-- New Supabase projects don't expose tables to the site automatically.
-- Row-level security (0001) still decides who sees and changes what.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on filings, flags, email_recipients, payment_lines to authenticated;
grant insert on activity_log to authenticated;
grant update on profiles to authenticated;
grant execute on function set_payment_status(uuid, text) to authenticated;
grant execute on function is_firm_user() to authenticated;
grant execute on function my_role() to authenticated;
