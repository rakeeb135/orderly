# PRESENTATION_SLIDE_UPDATE_GUIDE.md

**Limitation:** your existing slides were **not supplied**, so I cannot tell you what each slide currently says. The "Existing content" column therefore tells you what to *check for*; the "Final content" column is what the slide should say once the implementation is verified. Fill `[brackets]` with real results only.

| # | Slide | Existing content (check for…) | Actual implementation | Change required | Final content |
|---|---|---|---|---|---|
| 1 | Front page | Milestone number / date | — | Make sure it says **Progress Review** and matches the report (the report calls itself Milestone 5 progress report; your brief says Milestone 4 presentation — use the name on your course schedule) | Course code, title, group 70, members + IDs, supervisor, date |
| 2 | Agenda | 16 headings? | — | Keep exact required order | Numbered list |
| 3 | Team & roles | Roles from older slides | Report Appendix G ≠ brief roles; commits only by Ammaar & Rakeeb so far | Show **actual contribution so far** and **role going forward** | Table: Member · Role · What they have built/reviewed/tested (true) |
| 4 | Introduction | Problem text | unchanged | Keep; one line "in Sri Lanka, distance/part-time students" | 3 bullets |
| 5 | Objectives | O1–O10 | O1–O6, O9, part of O7 touched | Add progress marker per objective | O-list with ✔ / partial / ☐ |
| 6 | Functional requirements | 16 FRs | 41/67 complete, 9 partial, 17 not started (code-level) | Add status column; one bar chart | FR-01…FR-16 with status colours |
| 7 | Non-functional requirements | NFR list | RLS, validation, responsive built; perf/usability untested | Mark verified vs not | NFR table: Implemented / Verified / Pending |
| 8 | Architecture | Figure A1 | Matches; chat sends directly under RLS; Storage unused | Add "implemented" highlight | Figure A1 with implemented components ticked |
| 9 | Use case | Figure 1 | Implemented: Register/Login, Search&Filter, View Profile, Send/Accept Connection, Exchange Messages, Manage Profile, Manage Availability, Manage Users (+approve mentors). Not implemented: Request/Accept Session, View Session Status, Give Feedback, Moderate/Reports | Colour implemented vs pending; rename "Allow Users" | Coloured diagram + legend |
| 10 | Wireframes / UI | Figma/prototype pics | Running app | Side-by-side **prototype vs real page** (3 pairs) | 3 screenshots pairs |
| 11 | **Project progress** | "30 %" or similar? | see below | **Remove any unsupported % claim** | see below |
| 12 | Jira | maybe synthetic graphic | real board | Replace with real screenshot | see below |
| 13 | Git | 8 commits / 3 PRs | new branches/PRs | Replace with real screenshots | see below |
| 14 | Retrospective | Aug/Sep/Oct | — | Use actual text, condensed; add a real post-integration reflection if one happened | 3 columns: went well / challenges / improvements |
| 15 | Limitations | "no backend" | outdated | Replace | Sessions, feedback, reports, categories, password reset not built · live testing in progress · not deployed · limited backend experience · late start (coding began in October) |
| 16 | Modules / demo | — | see below | Replace with working-module list | see below |
| + | AI usage (if required) | — | — | One slide/footnote | "ChatGPT: UI guidance. Claude: report drafting and generation of the implementation, tests and documents. All output reviewed and run by the team; Appendix F." |

## Slide 11 — Project Progress (the one the panel will scrutinise)
| Dimension | What to write | Source |
|---|---|---|
| Frontend | "17 of 21 prototype screens built as data-backed pages (81 %)" | audit §7 |
| Backend | "Auth, roles, RLS, 6 server functions, realtime chat" — **no %** unless you compute one | 30% file §20 |
| Database | "7 tables + 1 view, 3 migrations; constraints & RLS tested on PostgreSQL" | `supabase/` |
| Functionality | "Register/login · approve mentors · search & filter · request/accept connection · realtime chat · publish slots" — add "(verified live on <date>)" **only if true** | smoke test |
| Testing | "30 unit tests · ≈46 DB assertions · manual E2E: [x of 12 steps passed]" | QA plan |
| Git | Real: commits, PRs, per-author counts | GitHub |
| Jira | Real: issues Done / Testing / To Do | Jira |
| Overall | "68 % of SRS sub-requirements implemented at code level; sessions, feedback, reports and deployment remain." **Do not write "30 % completed"** unless your supervisor's definition matches this and the live smoke test has passed. | matrix |

## Slide 12 — Jira screenshot
Capture the **Board** (or Backlog with epics grouped): all columns visible, Epics panel open, issue keys (SCRUM-n), assignees' avatars, the active sprint name/dates, counts per column. Show at least one issue linked to a PR (open an issue → Development panel) as a second small image. Panel should understand: work is broken into epics/stories, owned by named people, flows through review/testing, and what is still To Do. Do not retouch; do not include issues you didn't create.

## Slide 13 — GitHub
Four captures: (1) repo home with README; (2) Branches page (`main`, `develop`, feature branches); (3) Pull requests (Closed) list with review markers; (4) Insights → Contributors (commit count per person) — plus one PR page showing a reviewer's approval comment. State plainly who has committed.

## Slide 16 — Working modules (replace with your tested truth)
```
Working Modules (verified live: <date>)
✓ Authentication & role-based access
✓ Mentor discovery: search, filter, profile
✓ Connection request → accept
✓ Real-time messaging
✓ Mentor availability slots
✓ Admin: mentor approval, user (de)activation
Not yet: sessions · feedback · reports · password reset · deployment
```
Delete any ✓ that failed rehearsal.
