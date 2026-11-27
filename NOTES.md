# Payment & Filing Control System — project notes

Full spec: `Avrumy D\Payment System\Payment & Filing Control System — Spec.pdf`
Agent field map and check rules: `Avrumy D\Payment System\Agent Map\` (Check Rules.csv, Field Map - Payments.csv)

## Stack
- Site: React + Vite + Tailwind (same stack as Lovable, so it can move to Lovable later)
- Hosting: Cloudflare Worker with static assets (`wrangler.jsonc`), auto-deploys on push to `main`
- Database / logins / server functions: Supabase (Google sign-in, schapiracpa.com only)
- Code: GitHub, pushed from GitHub Desktop

## Data structure (agreed)
Client group → Entity → Filing (entity + tax year + Extension/Return) → Payment line (department + tax type + owner)
- No separate tax-year level; the year is on the filing.
- Payment line = one per department and tax type (e.g. NJ-1065 filing fee and NJ-CBT-1065 nonresident tax are two lines).
- Client ID = Karbon "Client Identifier" (Contact → Details → Basics). Return type comes from UltraTax (data mining, then agent pull).
- Preparer approval is not tracked per client response; only the "Preparer approved in Karbon" checkbox on flags (preparer name, who, when).
- NJ 80% check dropped (user decision 11/25).

Schema: `supabase/migrations/0001_schema.sql` + `0002_grants.sql` (both applied to Supabase project rowhrgwrdxdfuaoxwjxo)
Sign-in: email link (Google sign-in later). Supabase Site URL = https://notice-prevention.avrumy.workers.dev

## Secrets (never in code or chat)
- Supabase Edge Function secrets: `KARBON_BEARER_TOKEN`, `KARBON_ACCESS_KEY` (saved)
- Cloudflare build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Built
- Karbon sync: Edge Function `karbon-sync` (supabase/functions/karbon-sync). Groups from /ClientGroups (+ Members per group), entities = group members (+ active ones with a Client Identifier). Preparer = ClientManager ?? ClientOwner (entity, else group). 169 groups / 1,187 entities on 11/27.
- Site layout: left sidebar; Clients → group → entity (tax years) → year (Extension / Return tabs)
- Database schema with roles (admin / manager / staff) and row-level security
- Pages: Admin workload, Pending approvals, Payment confirmations, Client database, entity page, filing page
- Mark as filed, "Preparer approved in Karbon" on flags, payment check-offs, activity log

## Also built (11/27, second pass, per Penalty_Prevention_Process_Overview.pdf)
- Tabs: Clients, Work (Karbon tax work items from "Send Return to Client" / "Ext - Send to Client" or a later filing status until Completed; extension vs return from the status; PTET and amended excluded), Client approvals, Payment confirmations, Upcoming payments, Settings (admin)
- Only active Karbon clients shown (Inactive and Internal hidden; view client_group_list)
- Client group tabs: Entities / Return payments / Payment plans / Banks & info. Entity tabs: Tax years / Payment plans / Banks & info
- Bank accounts encrypted with a Vault key (bank_key) via save_bank_account / reveal_bank; every reveal logged in bank_reveals
- Estimated payment plans (src/lib/plans.ts): safe-harbor suggestion (100/110%, NJ 100%, PTET 100% prior / 90% current / 120% starting), quarterly or monthly, business-day dates (federal holidays + DC Emancipation Day), late start, who pays per payment, penalty savings at app_settings.underpayment_rate (7% Q4 2026)

## UltraTax agent (0008, 0009)
- Agent calls only agent_heartbeat / agent_claim_job / agent_finish_job with the publishable (anon) key + agent secret (bcrypt hash in agent_state; set with `select agent_new_secret();` in SQL editor)
- Site: Pull / Update / Final pull on the year page create agent_jobs rows (admin only, one active job per filing); page polls every 3s
- finish: raw result stored with bank numbers masked; full numbers encrypted in filing_banks; filings.last_pull_at, states_filed, diagnostics set
- NEXT: map result into payment_lines + run Check Rules (build against Payment System\Agent\Pull Results samples)

## Not built yet
1. Nightly Karbon sync (the Sync Karbon button on Clients works now)
2. Data mining import → prior_year_amounts
3. Agent connection (Pull / Enter in UltraTax / Final pull) → payment lines, flags, diagnostics
4. Checks engine (Check Rules.csv)
5. Bank encryption + Reveal / Copy (logged)
6. First email from Mendel's Gmail; client page on payments.schapiracpa.com
7. Reminders + payment confirmation emails from payments@schapiracpa.com
