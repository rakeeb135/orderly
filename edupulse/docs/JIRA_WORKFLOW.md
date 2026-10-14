# JIRA_WORKFLOW.md

Project key `SCRUM` (board: edupulse.atlassian.net). Report evidence: 4 issues (SCRUM-6..9) all Done, workflow `To Do → In Review → Done`.

## Workflow (recommended; change the board *before* taking screenshots)
`TO DO → IN PROGRESS → CODE REVIEW → TESTING → DONE`
**Done = acceptance criteria satisfied and verified by someone other than the author.** If you keep the 3-state board, say so honestly rather than showing a 5-state diagram you don't use.

## Epics (from the SRS only)
| Epic | Covers |
|---|---|
| E1 Authentication & Access Control | FR-01, FR-02 |
| E2 Profiles | FR-03 |
| E3 Mentor Discovery | FR-04–06 |
| E4 Connections | FR-07, FR-08 |
| E5 Messaging | FR-09 |
| E6 Availability & Sessions | FR-10–13 |
| E7 Feedback | FR-14 |
| E8 Administration & Moderation | FR-15 |
| E9 Quality, Testing & Deployment | FR-16, NFRs, QA, Vercel |
| E10 Documentation & Governance | SRS, report, retrospectives, CMMI |

## Stories → tasks (create issues that match reality)
Create issues for work **that exists** with status matching reality (e.g. "Supabase schema & RLS" → Testing until live smoke test passes), and for work that doesn't exist with status To Do. Do not create issues merely to inflate counts, and do not mark Done what hasn't been verified.

| Story | Tasks | Status today |
|---|---|---|
| As a visitor I can register and log in (E1) | schema+trigger, auth actions, forms, middleware | Testing (code-complete, unverified live) |
| As a mentor I can maintain a profile (E2) | form, validation, approval state | Testing |
| As a student I can find a mentor (E3) | view, search/filter, pagination, profile page | Testing |
| As a student I can request a connection (E4) | RPC, panel, requests page, cancel | Testing |
| As a user I can chat (E5) | table+RLS, realtime client, unread | Testing |
| As a mentor I can publish slots (E6) | constraint, form, list | Testing |
| As a student I can request a session (E6) | — | To Do |
| As a student I can leave feedback (E7) | — | To Do |
| As an admin I can approve mentors / manage users (E8) | RPCs, pages | Testing |
| Reports & categories (E8) | — | To Do |
| QA: live smoke test, bug fixing (E9) | steps 1–12 | In Progress |
| Deploy to Vercel (E9) | — | To Do |

## Sprints (2 weeks, suggested)
Sprint 1 (to the Progress Review): integrate + live-verify the slice above, fix bugs. Sprint 2: sessions + feedback. Sprint 3: reports, categories, password reset, polish. Sprint 4: testing, deployment, final report.

## Bug issues
Type Bug: title, steps, expected/actual, severity, linked PR. Rakeeb verifies & closes.

## Slide screenshot
See `PRESENTATION_SLIDE_UPDATE_GUIDE.md` slide 12.
