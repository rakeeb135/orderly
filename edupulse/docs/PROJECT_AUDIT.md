# PROJECT_AUDIT.md — EduPulse (Group 70)

Audit date: 9 October 2026 · Prepared with AI assistance (see `AI_USAGE_DECLARATION.md`)

## 0. What I could and could not inspect (read this first)

| Input | Supplied? | Consequence |
|---|---|---|
| Progress Report (.docx) incl. full SRS, retrospectives, Jira/Git evidence, CMMI minutes | ✅ | Fully read. Used as the requirements source. |
| `final_prototype.html` (interactive prototype, 3 roles, in-memory data) | ✅ | Used as the **approved UI** reference. |
| **Existing GitHub source code** (`amr-0529/edupulse`) | ❌ | **Could not be inspected.** I only know from the report that it holds a Next.js landing page, student dashboard and mentor discovery UI on sample data (SCRUM-6..9). |
| Progress Presentation slides | ❌ | **Could not be audited.** `PRESENTATION_SLIDE_UPDATE_GUIDE.md` is therefore a *build-the-slides* guide, not a diff. |
| Marking rubric / progress-review instructions | ❌ | The 16-slide structure and "~80 % frontend / ~30 % project" target are taken from your brief, not from the rubric itself. |

**Consequence:** the code in this package is a **new, self-contained Next.js + Supabase codebase** built from the SRS and the prototype. It has to be merged into your existing repository by your team (see `GIT_WORKFLOW.md` §"Integrating this package"). Where your existing `SCRUM-7/8/9` pages are better or already approved, keep them and re-point them at the real data layer.

## 1. Current completed features (existing repo, per report Table 4)
- Next.js project + GitHub repo + Jira project (SCRUM-6).
- Landing page (SCRUM-7), student dashboard (SCRUM-8), mentor discovery UI on sample data (SCRUM-9), each merged by reviewed PR.

## 2. Features added by this package (code-complete, see §6 for how far they are *verified*)
Authentication (register/login/logout, session cookies, role middleware, deactivated-account refusal) · profiles (student & mentor) · mentor discovery with search / category / experience filter / sort / pagination · mentor profile with connection state · connection requests (send, cancel, accept, decline, duplicate + 7-day rules) · realtime messaging · mentor availability (add/remove slots) · admin overview, mentor approval, user list + (de)activation · Supabase schema, RLS, RPC functions · unit tests · DB tests.

## 3. Partially completed
| Item | What exists | What is missing |
|---|---|---|
| Email verification (FR-01.2) | Supabase sends link; `/auth/callback` exchanges code; login explains unverified state | "Resend email" button |
| Discovery sort (FR-05.4) | newest / name / experience | sort by rating (no feedback data yet) |
| Mentor profile rating (FR-06.2) | shows "No reviews yet" | real average (needs feedback module) |
| Messages history (FR-09.5) | last 50 messages | "load older" paging |
| Availability (FR-10.3) | add, remove unbooked | edit slot |
| Admin dashboard (FR-15.1) | users by role, connections by status | sessions by status |
| Validation (FR-16.1) | zod on server for forms; chat validated client + DB constraint; DB constraints everywhere | zod on client for the server-action forms (they rely on HTML attributes + server errors) |

## 4. Not started
Password reset (FR-01.5) · profile photo (FR-03.5) · remove connection (FR-08.4) · session requests/management/status (FR-11–13) · feedback (FR-14) · report a user & moderation (FR-15.4) · category management UI (FR-15.5) · CSV export · help/FAQ pages · deployment · Playwright E2E tests.

## 5. Bugs / risks found
| # | Finding | Status |
|---|---|---|
| B1 | Deactivated users could still read their own connections/messages through RLS (found by test T42). | **Fixed** in `002_rls_policies.sql`; test now passes. |
| B2 | Mentor could see their own row in `mentor_directory` (test T21 expectation was too strict). | By design; test corrected to assert *other* mentors are invisible. |
| B3 | `next lint` failed on an `eslint-disable` for a rule not loaded. | Fixed (removed `any`). |
| R1 | PostgREST embed syntax (`profiles!connections_student_id_fkey(...)`, nested `student_profiles(...)`) is **not verified against a live Supabase project**. FK names were verified in PostgreSQL. | **Open – first thing to check in live smoke test.** |
| R2 | Realtime `postgres_changes` subscription under RLS not verified live. | **Open.** |
| R3 | Email confirmation is a Supabase *project setting*; if on, the demo needs real mailboxes (or turn it off for the demo). | Documented in README. |
| R4 | Per-request profile query in middleware (small latency cost). | Accepted for prototype. |

## 6. SRS vs code
See `REQUIREMENT_TRACEABILITY_MATRIX.md` (67 FR sub-requirements, each with status). Summary: **41 complete, 9 partial, 17 not started** (code-level; not live-verified).

## 7. UI vs code (prototype → Next.js)
Prototype has 21 distinct views. Implemented as real pages: Landing, Login, Register, Student {Dashboard, Discover, Mentor profile, Connections, Messages, Profile}, Mentor {Dashboard, Requests, Availability, Messages, Profile}, Admin {Overview, Approvals, Users} = **17 / 21 ≈ 81 %**. Missing: Student Sessions, Mentor Sessions, Admin Reports, Admin Categories. Prototype's "demo login" buttons are intentionally **not** reproduced (they would be fake authentication). Prototype sorts by rating; the code does not yet (see §3).

## 8. Report vs code — conflicts to resolve (details in `PROGRESS_REPORT_UPDATE_GUIDE.md`)
1. Report §6 says "no backend, authentication or real data" — now untrue **once this code is merged and verified**.
2. Report Appendix G / Table 4 give Ammaar & Rakeeb as the frontend developers and Thanish & Yugeswaran as "Development & Documentation"; your brief assigns Thanish = frontend/UI and Yugeswaran = backend. **Git evidence (Appendix D) shows 0 commits from Thanish and Yugeswaran.** Roles must be reconciled before the panel (see Risks in readiness report).
3. Report says Figma is "not yet used"; the approved UI is actually an HTML prototype.
4. Jira workflow in the report is `To Do → In Review → Done`; your brief uses a 5-state workflow. Pick one and make the board match.
5. Report ERD (Figure A2) is labelled "design only, not yet implemented" — now partially implemented, **and the implemented schema deviates from it** (see `ARCHITECTURE_UPDATE_GUIDE.md` §3):
   - **Mentor fields:** ERD/SRS FR-03.2 allow *several* mentoring fields (`fields` + `mentor_fields`); the prototype and this implementation allow **one** category per mentor (`mentor_profiles.category_id`). This is a real deviation from the SRS wording ("at least one field"). Decide: accept & amend SRS/ERD, or add a `mentor_fields` junction table (small migration + form/filter change).
   - Column renames (`current_role`→`job_title` because `current_role` is a PostgreSQL reserved word, `organization`→`organisation`, `is_accepting`→`accepting_students`, `start_time/end_time`→`starts_at/ends_at`, table `fields`→`categories`).
   - `profiles.email`, `bio`, `avatar_url` are not columns: email stays in `auth.users` (exposed to admins only via `admin_list_users`), bio lives in the role-specific profile tables, avatar not implemented.
   - Added columns not on the ERD: `mentor_profiles.approval_status/reviewed_by/reviewed_at` (needed for FR-15.6).
   - `reports`, `sessions`, `feedback` tables not created yet.
6. Use-case diagram (Figure 1) shows no explicit *Approve Mentor Account* use case (only "Manage Users", "Allow Users", "View Reports & Moderate") and links *Register / Login* only to Student although SRS UC-06 lists all actors.

## 9. Presentation vs code
Not auditable (slides not supplied). See slide guide.

## 10. Recommended changes (priority order)
1. Create Supabase project, run the three migrations, run `npm run seed:demo`, run the 12-step smoke test in `QA_TEST_PLAN.md` §"Live smoke test". Fix whatever fails (R1, R2 are the likely ones).
2. Merge into repo through real branches/PRs by the people who did the work (`GIT_WORKFLOW.md`).
3. Reconcile roles/contributions (§8.2).
4. Update report + slides **only after** step 1 passes.
