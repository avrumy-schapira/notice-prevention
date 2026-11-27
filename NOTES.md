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

Schema: `supabase/migrations/0001_schema.sql`

## Secrets (never in code or chat)
- Supabase Edge Function secrets: `KARBON_BEARER_TOKEN`, `KARBON_ACCESS_KEY` (saved)
- Cloudflare build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Built
- Database schema with roles (admin / manager / staff) and row-level security
- Pages: Admin workload, Pending approvals, Payment confirmations, Client database, entity page, filing page
- Mark as filed, "Preparer approved in Karbon" on flags, payment check-offs, activity log

## Not built yet
1. Karbon sync (nightly + Sync now) → client groups, entities
2. Data mining import → prior_year_amounts
3. Agent connection (Pull / Enter in UltraTax / Final pull) → payment lines, flags, diagnostics
4. Checks engine (Check Rules.csv)
5. Bank encryption + Reveal / Copy (logged)
6. First email from Mendel's Gmail; client page on payments.schapiracpa.com
7. Reminders + payment confirmation emails from payments@schapiracpa.com
