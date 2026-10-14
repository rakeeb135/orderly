# EduPulse — Student–Professional Mentoring Platform
OUSL EEY4189 Software Design in Group · Group 70 · Supervisor: Ms. Milani Sandamali Karunapala

Students find approved mentors, send connection requests, chat in real time and see mentor availability. Mentors manage requests, profile and slots. Administrators approve mentors and manage users.

## Status
Progress Review slice. See `docs/IMPLEMENTATION_STATUS.md`. Code-complete: auth, profiles, discovery, connections, messaging, availability, admin approvals/users. Not started: sessions, feedback, reports, categories UI, password reset, deployment. **Not yet verified against a live Supabase project** — run `docs/QA_TEST_PLAN.md` §B.

## Technology
Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Supabase (Auth, PostgreSQL + RLS, Realtime) · Zod · Vitest · Git/GitHub · Jira · Vercel (planned).

## Structure
```
src/app/            pages (public, student/, mentor/, admin/), server actions in actions/
src/components/     Shell, forms, ChatClient, MessagesView, ConnectPanel, ActionButton
src/lib/            supabase clients, auth guard, validation (zod), errors, formatting
src/middleware.ts   session refresh, auth + role gate (403)
supabase/migrations 001 schema · 002 RLS/RPC · 003 category seed
supabase/tests/     local-only DB test harness (never run on Supabase)
scripts/            seed-demo-users.mjs (service key, local only) · test-db.sh
tests/              Vitest unit tests
docs/               audit, matrix, QA, Git/Jira, demo script, report & slide update guides
```

## Setup (beginner-friendly)
1. Install Node.js 20+ and Git.
2. `npm install`
3. Create a free project at supabase.com. In **Project Settings → API** copy the Project URL and the `anon` public key.
4. `cp .env.example .env.local` and fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
5. **Database:** Supabase → SQL Editor → run, in order, `supabase/migrations/001_initial_schema.sql`, `002_rls_policies.sql`, `003_seed_data.sql`. (Or with the Supabase CLI: `supabase db push`.)
6. **Auth settings:** Authentication → URL Configuration → add `http://localhost:3000/auth/callback` to Redirect URLs. For a quick demo you may disable *Confirm email* (Authentication → Providers → Email); re-enable it afterwards and be honest about it in the demo.
7. **Demo data:** add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (**secret — never commit, never put on Vercel**) then `npm run seed:demo`. Creates `alex@`, `nimali@` (students), `sarah@`, `daniel@`, `nadeesha@` (approved mentors), `ayesha@` (pending mentor), `admin@edupulse.lk`, all with password `Password1`. Delete/rotate after the presentation.
8. `npm run dev` → http://localhost:3000

## Scripts
`npm run dev | build | start | lint | typecheck | test | seed:demo` · `./scripts/test-db.sh` (needs a local PostgreSQL; **not** for Supabase).

## Security notes
Passwords handled by Supabase Auth. RLS on every table; clients can only call the listed RPC functions; roles cannot be changed from the client; admins cannot self-register; service-role key is used only by the local seed script. Text is rendered through React (escaped).

## Git workflow / Jira
`docs/GIT_WORKFLOW.md`, `docs/JIRA_WORKFLOW.md`.

## Deployment (planned, not done)
Import the repo into Vercel, set the two `NEXT_PUBLIC_` variables + `NEXT_PUBLIC_SITE_URL`, add the Vercel URL to Supabase redirect URLs.
