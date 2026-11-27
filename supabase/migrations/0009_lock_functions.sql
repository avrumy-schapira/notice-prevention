-- 0009: anon (publishable key) may call only the 3 agent functions
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to service_role;
grant execute on function handle_new_user() to supabase_auth_admin;
grant execute on function my_role(), is_firm_user(), set_payment_status(uuid, text), save_bank_account(uuid, text, text, text, text, text),
  reveal_bank(text, uuid, text), valid_routing(text), is_active_status(text), agent_last_seen() to authenticated;
grant execute on function agent_heartbeat(text, text, text), agent_claim_job(text, text), agent_finish_job(text, bigint, jsonb, text) to anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
