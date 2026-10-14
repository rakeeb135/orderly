# AI_USAGE_DECLARATION.md

Draft for Appendix F. **Edit so it states only what is true for your team.** The report's existing Appendix F lists ChatGPT and Claude; keep both if both were used, and add this build.

| AI Tool | Purpose | Generated Output | Team Verification |
|---|---|---|---|
| Claude (Anthropic) — this session | Inspected the progress report/SRS and the HTML prototype; **generated a Next.js + Supabase implementation** of the SRS slice (auth, profiles, discovery, connections, messaging, availability, admin), SQL migrations with RLS/RPC, unit and database tests, and the planning/guide documents in `docs/`. | Source under `src/`, `supabase/`, `tests/`, `scripts/`; documents under `docs/` and `README.md`. | The AI itself ran type-check, lint, build, 30 unit tests and a local-PostgreSQL schema/RLS suite (results in `QA_TEST_PLAN.md` §A). **It did not run the app against Supabase or a browser.** The team must: read each module, run the live smoke test, record real results, and fix defects. *(Fill in who reviewed what, and when — only after it happens.)* |
| ChatGPT (existing entry) | Guidance for landing page, dashboard, discovery UI and Jira/GitHub workflow; report feedback | Code suggestions, feedback | Pull-request peer review |
| Claude (existing entry) | Drafting report/SRS text, architecture and ER diagrams | Text, tables, diagrams | Team corrected to real status |

## Honesty notes for the panel
- The backend/feature code in this package was produced by AI from the team's own SRS and prototype. The panel may ask what each member can personally explain and modify; prepare for that (`PANEL_QA_PREPARATION.md`).
- Do not describe AI-generated work as hand-written, and do not record commits under another person's name.
