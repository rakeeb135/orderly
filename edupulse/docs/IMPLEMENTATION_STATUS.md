# IMPLEMENTATION_STATUS.md (as of 9 Oct 2026)

## Completed (code-complete; local checks pass; **not yet live-verified**)
Auth · role gating · student/mentor profiles · discovery (search, category, experience, sort, pagination) · mentor profile + connection state · connection requests (send, cancel, accept, decline, duplicate & 7-day rules) · realtime chat (send, receive, unread, retry) · availability (add, remove, overlap/time rules) · admin overview, mentor approval, user (de)activation · schema + RLS + RPC + seed (categories).

## Partially completed
Email verification (no resend) · sort (no rating) · rating display · message history (last 50) · slot editing · admin stats (no sessions) · client-side validation of server-action forms.

## Not started
Password reset · profile photo · remove connection · sessions (FR-11–13) · feedback (FR-14) · reports/moderation (FR-15.4) · category admin UI (FR-15.5) · CSV export · help/FAQ · Vercel deployment · browser E2E tests · accessibility audit.

## Known bugs / open risks
None *confirmed* in running software (it has not been run against Supabase). Open risks R1–R4 in `PROJECT_AUDIT.md` §5. Fixed during build: B1 (deactivated user data access), B3 (lint).

## Remaining features (by SRS priority)
High: nothing High-priority left except live verification, FR-11.x/12.x (session request/accept), FR-16.1 completion. Medium: FR-01.5, 08.4(L), 13, 14, 15.1/15.4/15.5, 09.5. Low: 03.5, 05.4 rating sort, 07.4 done.

## Current meaningful progress (evidence-based)
- 41 / 67 FR sub-requirements complete + 9 partial at code level (68 %).
- 17 / 21 prototype views implemented as data-backed pages (81 %).
- Verified automatically: `tsc` clean · `next lint` clean · `next build` OK (22 routes) · Vitest 30/30 · local-PostgreSQL migration + RLS suite passes.
- **Not** verified: any behaviour against a live Supabase project or a browser.

## Evidence
Commands and results are reproducible: `npm run typecheck && npm run lint && npm test && npm run build` and `./scripts/test-db.sh`.
