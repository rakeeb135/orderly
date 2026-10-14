# QA_TEST_PLAN.md

Owner: Rakeeb (QA) with Ammaar. **Results column: `NOT TESTED` until a team member actually runs it and writes the date + initials. Do not pre-fill.**

## A. Automated checks that already exist (run by the AI during build — re-run yourselves and record)
| ID | Check | Command | Result recorded in build session |
|---|---|---|---|
| A1 | Type check | `npm run typecheck` | passed |
| A2 | Lint | `npm run lint` | passed |
| A3 | Unit tests (30) | `npm test` | 30/30 passed |
| A4 | Production build | `npm run build` | passed (placeholder env) |
| A5 | Migrations + RLS/constraint/RPC tests on **local PostgreSQL 16** with a Supabase stub | `./scripts/test-db.sh` | "ALL RLS TESTS PASSED" |
Team re-run date / initials: ________ (**NOT TESTED by team**)

## B. Live smoke test (must pass before any claim in report/slides) — 12 steps
Prereq: Supabase project, migrations 001–003 applied, `.env.local` set, `npm run seed:demo`, `npm run dev`. For demo speed turn **off** "Confirm email" in Supabase Auth settings (and say so honestly), or use real mailboxes.
1. Register a new student → account created, redirected / told to verify.
2. Log in as `alex@edupulse.lk` → student dashboard.
3. Discover shows Sarah, Daniel, Nadeesha but **not** Ayesha (pending). 
4. Search `react` → Sarah only; filter field "Data Science" → Nadeesha; min 7 / max 3 → range error.
5. Open Sarah → "Connect" visible, availability says "Connect to view availability".
6. Send request with message → button becomes "Request sent"; duplicate attempt impossible.
7. Log in as `sarah@edupulse.lk` (second browser/incognito) → Requests shows Alex's message → Accept.
8. Alex: Connections shows `accepted`; Messages lists Sarah.
9. Alex sends "hello" → appears **in Sarah's open chat without refresh**; Sarah replies; unread badge behaviour observed.
10. Sarah adds a future slot; adding an overlapping one is rejected; Alex's Sarah-profile page now lists the slot.
11. Log in as `admin@edupulse.lk` → Approvals shows Ayesha → Approve → she appears in Discover.
12. Admin deactivates Nimali → she cannot log in ("deactivated").
Result: **NOT TESTED**.

## C. Test cases
| ID | Area | Case | Expected | Result |
|---|---|---|---|---|
| TC-01 | Registration | Valid student | account + profile rows exist | NOT TESTED |
| TC-02 | Registration | Duplicate email | "already registered" | NOT TESTED |
| TC-03 | Registration | Weak password / bad email / 1-char name | field errors, nothing created | NOT TESTED (rules unit-tested) |
| TC-04 | Registration | role=admin via tampered form | rejected / becomes student | NOT TESTED (DB T01 passes) |
| TC-05 | Auth | Wrong password | generic "Invalid email or password" | NOT TESTED |
| TC-06 | Auth | Unverified email | verification message | NOT TESTED |
| TC-07 | Auth | Logout then open protected URL | redirect to login | NOT TESTED |
| TC-08 | Authorisation | Student opens `/mentor/dashboard`, `/admin/dashboard` | 403 page | NOT TESTED |
| TC-09 | Authorisation | Logged-out opens `/student/discover` | redirect to login | NOT TESTED |
| TC-10 | Profile | Student saves empty institution | field error | NOT TESTED |
| TC-11 | Profile | Mentor years = 61, 0 skills, 11 skills | errors | NOT TESTED (unit ✔) |
| TC-12 | Profile | Mentor saves complete profile | success; pending mentor still hidden | NOT TESTED |
| TC-13 | Discovery | Pending/rejected/deactivated/not-accepting mentor | not listed | NOT TESTED (DB T04 ✔) |
| TC-14 | Discovery | Keyword with `,` `%` `(` | no error, sanitised | NOT TESTED (unit ✔) |
| TC-15 | Discovery | >12 mentors | pagination | NOT TESTED (needs data) |
| TC-16 | Discovery | No match | empty state | NOT TESTED |
| TC-17 | Mentor profile | Random UUID / non-UUID | 404 | NOT TESTED |
| TC-18 | Mentor profile | Unconnected student | availability hidden | NOT TESTED (DB T36 ✔) |
| TC-19 | Connection | Send 301-char message | blocked | NOT TESTED (unit ✔, DB T09 ✔) |
| TC-20 | Connection | Duplicate pending | blocked | NOT TESTED (DB T07 ✔) |
| TC-21 | Connection | Cancel pending | row removed | NOT TESTED |
| TC-22 | Connection | Decline → resend within 7 days | blocked with date | NOT TESTED |
| TC-23 | Connection | Mentor accepts twice / after cancel | friendly message | NOT TESTED (DB T23 ✔) |
| TC-24 | Messaging | Send blank / 1001 chars | blocked | NOT TESTED (unit ✔, DB ✔) |
| TC-25 | Messaging | Chat on pending connection | blocked | NOT TESTED (DB T12 ✔) |
| TC-26 | Messaging | Realtime delivery < 2 s (NFR-03) | appears without refresh | NOT TESTED |
| TC-27 | Messaging | Offline send | error, text kept | NOT TESTED |
| TC-28 | Messaging | `<script>` in message | rendered as text | NOT TESTED |
| TC-29 | Messaging | Unrelated user reads conversation by guessed id | no data | NOT TESTED (DB T35 ✔) |
| TC-30 | Availability | Past, <15 min, >120 min, overlap | each rejected | NOT TESTED (unit ✔, DB ✔) |
| TC-31 | Availability | Remove open slot | removed | NOT TESTED |
| TC-32 | Admin | Non-admin calls admin RPC from console | "Not allowed" | NOT TESTED (DB T14,T15 ✔) |
| TC-33 | Admin | Approve mentor → listed | listed | NOT TESTED |
| TC-34 | Admin | Deactivate self | refused | NOT TESTED (DB T40 ✔) |
| TC-35 | Admin | Deactivated user logs in / keeps session | refused / redirected | NOT TESTED |
| TC-36 | Security | Anon API read of `profiles` | denied | NOT TESTED (DB T43 ✔) |
| TC-37 | Security | `SUPABASE_SERVICE_ROLE_KEY` absent from browser bundle | not found | NOT TESTED |
| TC-38 | Responsive | 360 px width, no horizontal scroll | OK | NOT TESTED |
| TC-39 | Compatibility | Chrome, Edge, Firefox, mobile Chrome/Safari | OK | NOT TESTED |
| TC-40 | Sessions / Feedback | — | module not built | N/A (NOT STARTED) |

## D. Bug log
| Bug | Found by | Severity | Status | Retested |
|---|---|---|---|---|
| (add real bugs found during B/C here) | | | | |
