# PANEL_QA_PREPARATION.md

Answer from the real state. If you don't know, say so and say how you'd find out. **Each member must be able to answer for the module they present.** Since much of the code was AI-assisted, practise explaining *how it works* (open the file) rather than reciting.

**Project / problem / scope** — *What problem?* Students lack a structured way to find a suitable mentor, contact them and arrange guidance; EduPulse puts discovery, connection, chat and (later) sessions in one place. *Why not LinkedIn?* It isn't built around the student→mentor workflow (report Table 2). *What's out of scope?* Payments, mobile apps, built-in video, AI matching.

**Objectives / requirements** — *Which objectives are met?* Partly O1–O6, O9; O7 partly (availability yes, session requests no); O8 not yet. *How do you know?* Requirements Traceability Matrix: 41/67 sub-requirements complete, 9 partial, 17 not started at code level.

**Architecture** — Next.js UI + server actions with Zod validation → Supabase Auth, PostgreSQL with RLS, Realtime. *Deviation from the diagram?* Chat messages are inserted straight from the browser to Supabase (RLS enforces who can send); reads/other writes go through server components/actions. Profile photos/Storage not used yet.

**Database** — Tables: profiles, student_profiles, mentor_profiles, categories, connections, messages, availability_slots; view `mentor_directory`. Constraints: unique partial index prevents duplicate active requests; exclusion constraint prevents overlapping slots; CHECKs on lengths/status. *Why a trigger?* `handle_new_user` creates the profile and forces role to student/mentor so nobody can register as admin. *Sessions/feedback tables?* Not created yet — deliberately, to avoid claiming work not done.

**Authentication** — Supabase Auth (hashed passwords, JWT cookies via `@supabase/ssr`); middleware validates the user with `getUser()` and gates `/student`, `/mentor`, `/admin`; wrong role → 403; deactivated users are signed out. Email verification is a Supabase setting.

**Security** — RLS on every table; column-level grants (a user can't edit their role or approval status); sensitive operations only via RPC functions that re-check role/ownership; `anon` has no table access; the service-role key lives only in a local seed script; text is escaped by React. *Proof?* `supabase/tests/rls_tests.sql` (≈46 assertions) passes on local PostgreSQL. *Limitation:* not yet pen-tested; live Supabase verification pending.

**Technology choices** — Supabase gives Auth+Postgres+Realtime without writing a server; Next.js gives routing/SSR and Vercel deployment; Tailwind for the approved design; Zod for shared validation. Alternatives considered: Firebase (NoSQL — our data is relational), custom Express API (more to build/maintain).

**Mentor legitimacy** (supervisor's concern) — New mentors are `pending` and invisible until an admin approves (FR-15.6); students cannot message unapproved mentors; mentors control who can chat via accept/decline. *Gap:* admin approval is manual — automated credential checks and reporting/moderation (FR-15.4) are future work.

**Testing** — 30 Vitest unit tests (validation), ~46 SQL assertions (constraints/RLS/RPC), type-check/lint/build. Live end-to-end checklist (12 steps) in QA plan: state honestly whether it has been run and results. *Why no Playwright tests?* Not yet; planned in the testing phase.

**Jira / Git** — Board shows SCRUM-6..9 Done plus new issues (state truthfully). PR-with-review workflow demonstrated in PR #1–#3. *Why only 8 commits earlier?* Coding began in October (Sept retrospective).

**Teamwork / individual contribution** — Be ready with the exact answer in Appendix G and the Git contributors page. Don't overclaim: report shows Ammaar and Rakeeb as the committers so far; explain how Thanish and Yugeswaran are contributing now (e.g. which PRs they author/review) — **only once true.**

**Progress** — *Is it really 30 %?* Say: "Our traceability matrix shows 68 % of SRS sub-requirements implemented at code level and 17 of 21 prototype screens. Because live verification is in progress we don't claim a single project-wide percentage; remaining major work is sessions, feedback, reports, deployment and full testing."

**Limitations / future work** — Sessions, feedback, reports/moderation, password reset, category admin UI, profile photos, deployment, E2E tests, accessibility review, notifications (out of scope), rating-based sort.

**AI** — Used ChatGPT (UI guidance) and Claude (drafting, and generation of this implementation + tests). Everything was reviewed by the team and must be explainable; AI declaration in Appendix F. *Can you modify it live?* Prepare one small change per member (e.g. change the request message limit from 300 → 500: `validation.ts`, `001_initial_schema.sql` CHECK, `send_connection_request`).

**Hard questions to rehearse**
1. "Show me where a student is prevented from reading another student's messages." → `messages_read` policy in `002_rls_policies.sql`.
2. "What stops a user calling the API directly?" → RLS + column grants + RPC checks; anon key has no table rights.
3. "What if two students request the same slot?" → Slot *requests* are not built yet (FR-11); the design plan is a unique active session per slot. Don't claim it.
4. "How does duplicate-request prevention work?" → partial unique index + RPC check.
5. "Why is the middleware querying the DB?" → to read role/is_active; trade-off: one extra query per request, acceptable for a prototype.
