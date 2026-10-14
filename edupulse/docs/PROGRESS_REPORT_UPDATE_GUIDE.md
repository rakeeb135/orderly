# PROGRESS_REPORT_UPDATE_GUIDE.md

**Rule:** update the report only after the live smoke test (`QA_TEST_PLAN.md` §B) has been run, and use `[bracketed]` items only with real results. History (meeting dates, September retrospective, earlier PRs, the 4-issue Jira count at the time) is **not** edited — progress is added on top of it. The report currently says it records progress "up to 10th October 2026"; keep that date consistent with the evidence you attach.

## 1. Section-by-section table
| Report section | Existing statement | Actual current state | Change required | New content |
|---|---|---|---|---|
| Cover / supervisor date | Signature date 2026/10/07 | — | None (unless re-signed) | — |
| 1 Introduction & Background | Describes search → request → chat → session flow; "Section 6 states what has actually been achieved" | Still accurate | None | — |
| 2 Problem & Objectives; "Changes Since the Proposal" | Objectives unchanged; mentor approval added (FR-15.6) | Mentor approval is now implemented | Optional one sentence | "Administrator approval of new mentors (FR-15.6) has been implemented in the current build." |
| 3 Similar systems | — | — | None | — |
| 4 Proposed Solution (last sentence) | "At the current milestone, implementation has progressed through the user-interface foundation for the landing page, student dashboard and mentor discovery (Section 6)." | Auth, profiles, discovery, connections, chat, availability, admin approvals/users built on Supabase | **Replace** that sentence | "At the current milestone, the team has implemented the first part of the core workflow — registration and login, role-based access, profiles, mentor discovery, connection requests, real-time messaging, mentor availability and administrator approval of mentors — on Supabase [verified end-to-end on <date>]. Session requests, feedback, reports and deployment remain." |
| 5 Main Use Case Diagram (Figure 1) | Diagram has "Manage Users / Allow Users / View Reports & Moderate"; Register/Login only on Student | Implementation matches the diagram *except* naming/links (see `ARCHITECTURE_UPDATE_GUIDE.md` §2) | Optional diagram edit; **no new functionality added** | Rename "Allow Users" → "Approve Mentor Accounts"; connect Register/Login to Mentor and Administrator. Add caption sentence: "Implemented so far: …" (list in guide). |
| 5 Technology Plan intro | "…the implemented work has primarily focused on the Next.js frontend and the project collaboration workflow." | Backend now implemented | **Replace** | "At the current milestone the planned stack is in use: Next.js/React/TypeScript and Tailwind CSS for the frontend, Supabase (Auth, PostgreSQL with Row Level Security, Realtime) for the backend, Zod for validation, Git/GitHub and Jira for collaboration. Deployment to Vercel is still planned." |
| Table 3 rows | Backend / Database / Auth / Realtime = "Planned" | Implemented in code | Change status text | Backend: "Implemented: server actions + RPC functions." Database: "Implemented: 7 tables + 1 view, migrations 001–003." Auth: "Implemented: Supabase Auth, role middleware." Realtime: "Implemented in chat [verified on <date>]." |
| Table 3 UI/UX row | "Figma — Planned … (not yet used)" | UI is the approved **HTML interactive prototype** | Correct the row | "Interactive HTML prototype (final_prototype.html) used as the approved UI; Figma not used." (SRS §4.1.3 also says "will be produced in Figma" — amend or footnote.) |
| Table 3 Testing row | "To be selected" | Vitest unit tests; SQL test suite for schema/RLS; manual QA plan | **Replace** | "Vitest (unit tests of validation); SQL tests of constraints, RLS and RPC on local PostgreSQL; manual test cases in `QA_TEST_PLAN`. Browser E2E tests planned." |
| Table 3 Jira row | "To Do → In Review → Done" | Depends on board | Make it match the board | Use the real workflow names. |
| Table 3 add rows | — | Zod, Vitest | Add | "Validation: Zod (client+server)"; "Unit testing: Vitest." |
| 6 Project Progress — **Table 4** | See §2 below | | **Rewrite rows** | See §2 |
| Governance Summary | "SCRUM-6..9 Done. Total issues created: 4." / "8 commits on main, 3 PRs" | Changes after you create/merge new work | Update numbers **from live Jira/GitHub only** | "Jira: <n> issues (<d> Done, <t> Testing/In review, <b> To Do). GitHub: <c> commits, <p> pull requests merged, contributors: <names with commit counts>." |
| Challenges & Limitations | "Current limits: no backend, authentication or real data yet. The system is not deployed." | Backend/auth/real data now exist; still not deployed | **Replace** | "Current limits: sessions, feedback, reports/moderation, category management and password reset are not implemented; end-to-end testing is in progress; the system is not yet deployed. The team had limited prior backend experience, which was addressed by [what actually happened]." |
| 7 Timeline — Table 5 | "October: Backend and database foundation, authentication, profiles, connection workflow — Upcoming" | Done in code, verification pending | Update status | See `TIMELINE_UPDATE_GUIDE.md` |
| Conclusion | Frontend foundation only | See §3 | **Replace** | §3 |
| App. A SRS — Document Revisions | v1.0 Pending review | SRS unchanged *except* possibly mentor-field multiplicity | Add v1.1 row **only if** you amend the SRS | "Oct 2026 · 1.1 · Clarified mentoring-field multiplicity; Figma→HTML prototype · Group 70" |
| App. A §6.2 ERD caption | "design only, not yet implemented" + "database has not yet been implemented" | Partly implemented, deviates | **Replace caption and note**; update/annotate figure | "Figure A2 – Planned ERD. Implemented tables: profiles, student_profiles, mentor_profiles, categories, connections, messages, availability_slots. Not yet implemented: sessions, feedback, reports. Differences from the plan are listed in …" |
| App. A §6.4 Initial UI concepts | Text list + 3 screenshots | Prototype + running app | Add screenshots of running pages | Optional |
| App. B Retrospectives | Aug, Sep, Oct | October entry says backend "outstanding" | **Do not edit history.** Add a short *"Update"* paragraph under October *only if the team actually held a retrospective* | Use real discussion; don't invent one. |
| App. C Jira evidence | 4 issues, 1 screenshot | New issues exist | Replace table/screenshot with current | Real screenshot (guide, slide 12) |
| App. D Git evidence | 8 commits, 3 PRs, screenshots 1–5 | New branches/PRs | Replace with current numbers/screens | Real screenshots; list per-author counts honestly |
| App. E CMMI minutes | Meetings 01–03 | Any new meeting? | Add minutes **only for meetings that really occurred** (e.g. backend planning) | Same CMMI template |
| App. F AI declaration | ChatGPT, Claude (report + UI) | Claude also generated the implementation | **Extend** | Use `AI_USAGE_DECLARATION.md` |
| App. G Team contribution | Ammaar frontend/lead; Rakeeb frontend; Thanish & Yugeswaran documentation | Brief gives different roles; commits show only two committers | Update to real contributions after integration | One row per member: what they actually built/reviewed/tested since the last report. Must match GitHub. |

## 2. Table 4 — before / after (replace the rows with what is *true* after verification)
| Existing report | After implementation |
|---|---|
| Landing, dashboard, discovery: "Complete … sample data, not a database" | Discovery and dashboards now read from Supabase; landing unchanged. |
| "Database / Supabase, authentication and roles, user profiles — Not started" | **Complete / In testing:** 7 tables + view, migrations 001–003, Supabase Auth, role middleware, RLS, profile forms. |
| "Connections, messaging, availability, sessions — Not started" | Connections **[Complete]**, Messaging **[Complete / In testing]**, Availability **[Complete]** (add/remove; edit missing); **Sessions — Not started.** |
| "Feedback and administration — Not started" | Administration: approvals + user management **[Complete / In testing]**; reports & categories Not started; **Feedback Not started.** |
| "Testing and deployment — Not started" | Testing **In progress** (30 unit tests, DB test suite, manual QA plan); Deployment **Not started.** |
| UI/UX "In progress — 3 screens" | 17 of 21 prototype views implemented as running pages. |
| Git/Jira: 8 commits/4 issues | Updated numbers from live tools. |

Use status words consistently: *Complete* only if verified live; otherwise *In testing*.

## 3. Recommended Progress paragraph(s) (§6 intro, replaces nothing historical)
> At the current milestone the team has moved from the interface foundation reported earlier to a working vertical slice of the EduPulse workflow. On the frontend, 17 of the 21 screens in the approved prototype are implemented as pages backed by real data: registration and login, student, mentor and administrator dashboards, profiles, mentor discovery with search, filters and pagination, mentor profile, connection management, messaging, mentor availability, mentor approval and user management. On the backend, Supabase Authentication, a PostgreSQL schema of seven tables and a discovery view, Row Level Security policies and server-side functions for connection requests and administrator actions have been implemented, and real-time messaging uses Supabase Realtime. Of the 67 detailed functional sub-requirements in the SRS, 41 are implemented and 9 partly implemented in code; session requests, feedback, reports and category management are not yet started. Testing so far consists of 30 unit tests of validation rules, an automated database test suite for constraints and access rules, and a manual test plan; [end-to-end test results: summarise real outcomes from QA §B]. The system is not yet deployed.

## 4. Updated Conclusion (replace the existing one)
> At the current milestone, EduPulse has progressed from an interface foundation to a working core workflow: users can register and log in with role-based access, mentors can build profiles and be approved by an administrator, students can search and filter approved mentors, send connection requests that mentors accept or decline, exchange messages in real time, and mentors can publish availability. The remaining work is session requests and management, feedback, reporting and moderation, category management, password reset, completion of testing, deployment to Vercel and the final documentation. The team will continue with these modules in the next phase, building on the existing Git and Jira workflow.

## 5. What must NOT be changed
Meeting dates and minutes, the August and September retrospectives, the proposal-era SRS version history, original problem statement, the factual statement that implementation began in early October, and the PR #1–#3 history.
