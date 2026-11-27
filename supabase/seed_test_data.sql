-- OPTIONAL: dummy test data so the pages show something before Karbon and the agent are connected.
-- Uses the UltraTax test clients (TEST...). Run in Supabase SQL Editor. Safe to delete later:
--   delete from client_groups where karbon_key like 'TEST-%'; delete from entities where karbon_key like 'TEST-%';

with g as (
  insert into client_groups (karbon_key, name) values ('TEST-G1', 'Test Group') returning id
), e as (
  insert into entities (client_group_id, karbon_key, name, client_id, return_type, assigned_preparer)
  select g.id, x.k, x.n, x.c, x.t, 'Avrumy Derbaremdiger' from g,
  (values ('TEST-E1','Test Partnership LLC','TEST1065','1065'),
          ('TEST-E2','Test S Corp Inc','TEST1120S','1120-S'),
          ('TEST-E3','Test Individual','TEST6789','1040')) as x(k,n,c,t)
  returning id, client_id
), f as (
  insert into filings (entity_id, tax_year, stage, status, last_pull_at, email_sent_at)
  select e.id, 2025, 'extension',
         case e.client_id when 'TEST1065' then 'pulled_flags_open'::filing_status
                          when 'TEST1120S' then 'emailed_waiting'::filing_status
                          else 'client_modified_ach'::filing_status end,
         now() - interval '2 days',
         case when e.client_id <> 'TEST1065' then now() - interval '1 day' end
  from e returning id, entity_id
)
insert into payment_lines (filing_id, department, tax_type, direction, amount, method, efw_enabled, payment_date, bank_last4, response, new_method, new_last4)
select f.id, x.d, x.t, 'due', x.a, 'efw', true, date '2026-03-16', '1234', x.r, x.nm, x.nl
from f join e en on en.id = f.entity_id
join (values
  ('TEST1065','NYC','NYC UBT',333.00,'waiting',null,null),
  ('TEST1065','NJ','NJ-1065 filing fee',444.00,'waiting',null,null),
  ('TEST1065','NJ','NJ-CBT-1065 nonresident tax',555.00,'waiting',null,null),
  ('TEST1120S','NYS','CT-3-S',201.00,'waiting',null,null),
  ('TEST1120S','NJ','CBT-100S',324.00,'waiting',null,null),
  ('TEST6789','IRS','Form 4868',1500.00,'modified','efw','9876'),
  ('TEST6789','NJ','NJ-630',402.00,'confirmed',null,null)
) as x(c,d,t,a,r,nm,nl) on x.c = en.client_id;

insert into flags (filing_id, check_code, message)
select f.id, 'nj_partnership_extension', 'NJ CBT-206 is $45.00 short of last year''s nonresident partner tax.'
from filings f join entities e on e.id = f.entity_id where e.client_id = 'TEST1065';
