# PROGRESS_REVIEW_PRESENTATION_PLAN.md — 10 minutes, 16 slides in the required order

Timing is deliberately uneven: ~2 min of context, ~2 min requirements/architecture, **~4 min on real implementation + demo**, ~2 min governance + honesty. Rehearse with a timer; cut slides' talking time, not the demo.

| # | Slide | Time | What it must say (only true statements) |
|---|---|---|---|
| 1 | Front page | 0:10 | EEY4189, EduPulse, Group 70, supervisor, date. |
| 2 | Agenda | 0:10 | Read the 16 headings in one breath, or show as a single line. |
| 3 | Members & roles | 0:25 | Four names + role. Show *current contribution* from Appendix G **and** planned role if they differ (see Git doc). |
| 4 | Introduction | 0:35 | Problem: students lack structured access to mentors; EduPulse = discover → connect → chat → (sessions later). |
| 5 | Objectives | 0:30 | O1–O10, mark which are touched: O1–O6, part of O7, O9, O10 (Git/Jira). O8 (feedback) not yet. |
| 6 | Functional requirements | 0:40 | 16 FR modules; "67 sub-requirements; 41 complete, 9 partial at code level" **only if the matrix is unchanged**. |
| 7 | Non-functional requirements | 0:25 | Security (RLS), responsive, validation, performance targets; say which are verified (DB-level security tests) and which are not yet. |
| 8 | Architecture | 0:35 | Next.js UI + server actions (Zod) → Supabase Auth/Postgres(RLS)/Realtime; Vercel planned. Note chat sends direct to Supabase under RLS. |
| 9 | Use case diagram | 0:20 | Highlight use cases now implemented (colour them) vs not started. |
| 10 | Wireframes / UI | 0:30 | Prototype next to **running app** screenshots (discover, profile, chat). |
| 11 | **Project progress** | 1:00 | Frontend / Backend / Database / Functionality / Testing / Git / Jira — numbers from `PROGRESS_REVIEW_30_PERCENT.md`, each labelled verified or code-level. |
| 12 | Jira board | 0:30 | Real screenshot; what is Done vs Testing vs To Do. |
| 13 | Git repository | 0:30 | Real screenshots: branches, PRs, contributors. |
| 14 | Retrospective | 0:25 | Aug/Sep/Oct retrospectives (Appendix B) — actual text; add what changed since. |
| 15 | Limitations & challenges | 0:30 | Sessions/feedback/reports/password reset not done; live verification/testing in progress; not deployed; limited backend experience; late start. |
| 16 | Modules + **live demo** | 2:00 | Follow `LIVE_DEMO_SCRIPT.md`. |
| — | Buffer / AI note | 0:10 | One line: AI used (ChatGPT, Claude); team reviewed; Appendix F. |
| | **Total** | **≈10:00** | Keep 15–20 s slack; if over, trim slides 2, 9, 14 first. |

Panel will remember the demo and how you handle questions. Never spend more than 1 minute on any slide before slide 11.
