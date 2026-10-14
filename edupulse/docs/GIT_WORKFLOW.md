# GIT_WORKFLOW.md

Repository: https://github.com/amr-0529/edupulse (from report Appendix D). Current state per report: 8 commits on `main`, 3 merged PRs (#1–#3), Ammaar 3 + Rakeeb 2 development commits, merges by Rakeeb. **Thanish and Yugeswaran have no commits yet.**

## Branches
```
main      – stable, demo-ready, protected (PR + 1 review required)
develop   – integration branch (create now)
feature/* – one Jira issue each, named with the key: feature/SCRUM-12-supabase-schema
bugfix/*  – bugfix/SCRUM-30-chat-duplicate-message
```
Note: your existing branches are named `SCRUM-7-landing-page` (no `feature/` prefix). Keep that style *or* switch — but be consistent and say so in the slide.

## Flow
Jira task → feature branch → develop → local test → commit → push → PR → code review → QA → merge to `develop` → integration test → merge `develop`→`main`.

## Integrating this package into the existing repo (do this in order)
1. `git checkout main && git pull && git checkout -b develop && git push -u origin develop`
2. Protect `main` and `develop` on GitHub (Settings → Branches → require PR + 1 approval).
3. **Read the code first.** Each member must be able to explain the module they commit (the panel will ask — see `PANEL_QA_PREPARATION.md`).
4. Compare the package with your existing `src/` / `app/` folders. Your existing landing page, dashboard and discovery UI may use different folder layouts or be JavaScript. Decide per file: keep yours and wire to real data, or take the package version. **Do not blindly overwrite `layout.tsx` / `globals.css` / `tailwind.config`.**
5. Suggested PR sequence (each is a real, reviewable unit; the author is whoever actually did the integration work for it):

| Branch | Content | Suggested owner (per brief) | Reviewer |
|---|---|---|---|
| `feature/SCRUM-10-supabase-schema` | `supabase/migrations/*`, `supabase/tests/*`, `scripts/test-db.sh` | Yugeswaran | Ammaar |
| `feature/SCRUM-11-auth-and-roles` | `src/lib/supabase/*`, `middleware.ts`, auth actions/pages, `.env.example` | Yugeswaran | Thanish |
| `feature/SCRUM-12-profiles` | profile actions + forms/pages | Thanish | Yugeswaran |
| `feature/SCRUM-13-mentor-discovery` | discover + mentor profile (replaces SCRUM-9 sample-data version) | Thanish | Ammaar |
| `feature/SCRUM-14-connections` | RPC wiring, ConnectPanel, requests, connections pages | Yugeswaran + Thanish | Ammaar |
| `feature/SCRUM-15-messaging` | ChatClient, MessagesView | Yugeswaran | Thanish |
| `feature/SCRUM-16-availability` | availability action/page | Thanish | Rakeeb |
| `feature/SCRUM-17-admin-approvals-users` | admin actions/pages | Yugeswaran | Ammaar |
| `feature/SCRUM-18-tests-and-docs` | `tests/`, `docs/`, README | Rakeeb + Ammaar | Thanish |

   **Commit with your own identity** (`git config user.name/email`). Never use `--author` or backdate to credit someone who did not do the work, and never invent commit history. If one person integrates everything because others were unavailable, the history should show exactly that — the honest story is more defensible than a tidy false one.
6. Per PR: `git checkout -b feature/SCRUM-xx-name develop` → work → `npm run typecheck && npm run lint && npm test` → `git add -p` → `git commit -m "feat(auth): add role middleware"` → `git push -u origin feature/...` → open PR → reviewer comments/approves → squash or merge into `develop`.
7. After QA live smoke test passes on `develop`: PR `develop` → `main`.

## Commit message format
`type(scope): summary` — `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. Reference the Jira key in the PR title: `SCRUM-14 Connection requests`.

## Responsibilities (brief) vs. report evidence
| Member | Brief | Report says (Appendix G) |
|---|---|---|
| Ammaar | BA / PM / lead: integration, review, requirements, docs | Team leader / frontend dev (SCRUM-7), reviewer |
| Rakeeb | QA / tester | Frontend dev (SCRUM-8, SCRUM-9), merged PRs |
| Thanish | UI/UX + frontend | Development & documentation |
| Yugeswaran | Backend, DB, auth, Supabase | Development & documentation |
**Resolve this before the panel.** The report must describe real contributions. If Rakeeb actually built SCRUM-8/9, the report is right about the past and the brief describes the *intended* role going forward — say so on the Team slide ("current contribution" vs "planned role").

## Evidence to show on the Git slide
Repo main page · branch list (`main`, `develop`, features) · commit graph/history with ≥3 authors **if true** · PR list with reviews · one PR with approval comment · contributors page (Insights → Contributors).
