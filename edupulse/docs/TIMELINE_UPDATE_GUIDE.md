# TIMELINE_UPDATE_GUIDE.md

Do not change the dates or statuses of the first three rows (Late Aug–Early Sep, Mid Sept, Late Sep–Early Oct); they are history. The report's own table is: Late Aug–Early Sep ✔ · Mid Sep ✔ · Late Sep–Early Oct ✔ · October (backend, auth, profiles, connection workflow) Upcoming · Oct–Nov (messaging, availability, sessions) Upcoming · November (feedback, admin, testing, integration, bug fixing) Upcoming · Late Nov (deployment, final docs) Upcoming · 1 Dec final report + demo.

| Period | Planned (report) | Actual (this package) | Suggested updated status text |
|---|---|---|---|
| October | Backend/DB foundation, auth, profiles, connection workflow | Implemented in code; live verification pending | "**In progress / ahead of plan** – implemented, in verification" → change to "Complete" only after QA §B |
| Oct – Nov | Messaging, availability, session management | Messaging ✔ and availability ✔ implemented **early**; sessions not started | "Messaging and availability: implemented; session management: upcoming" |
| November | Feedback, administration, testing, integration, bug fixing | Admin approvals/users implemented early; reports/categories/feedback not started; testing started | "Administration (partial) done; feedback, reports, categories, full testing: upcoming" |
| Late Nov | Deployment, final docs | Not started | Upcoming |
| 1 Dec | Final report, presentation | — | Upcoming |

**Remaining work (ordered):** 1) live verification + bug fixing · 2) session requests/management/status (FR-11–13) · 3) feedback (FR-14) · 4) reports/moderation + categories (FR-15.4/15.5) · 5) password reset, resend verification, remove connection, edit slot, older-message paging · 6) Playwright E2E + responsive/browser checks · 7) Vercel deployment · 8) final report/appendices.

Say "ahead of plan" only if you are comfortable explaining why (the October plan was set before this work existed). Never alter earlier dates.
