# ARCHITECTURE_UPDATE_GUIDE.md (also covers use-case update)

## 1. Architecture diagram (Figure A1) — comparison
| Diagram element | Implementation | Match? |
|---|---|---|
| Users → HTTPS → Next.js + React UI + Tailwind | Yes | ✔ |
| Next.js server layer: Server Actions / Route Handlers / Zod | Yes: `src/app/actions/*`, `/auth/callback`, `/auth/deactivated`, `lib/validation.ts` | ✔ |
| Server → Supabase Auth ("verify session") | `middleware.ts` + `requireRole` call `auth.getUser()` | ✔ |
| Server → PostgreSQL "SQL via Supabase client" | Supabase JS client (PostgREST/RPC), not raw SQL | ✔ (wording) |
| UI → Realtime "subscribe (messages)" | `ChatClient` subscribes to `postgres_changes` | ✔ |
| **Not on diagram:** chat **inserts** go browser → Supabase directly (RLS decides) | Yes | ➕ add arrow "send message (RLS)" from UI to PostgreSQL |
| **Not on diagram:** RPC/SECURITY DEFINER functions as the controlled write path for connections and admin actions | Yes | ➕ optional note in PostgreSQL box |
| GitHub auto-deploy → Vercel | Not set up | Mark dashed/"planned" |
| Jira ↔ GitHub linked issues | Branch names carry Jira keys; verify the Jira–GitHub integration is actually enabled | Check before claiming |
| Supabase Storage (SRS §2.3) | Not used | Leave out or mark planned |
**Edit needed:** small. Add the direct-message-insert arrow; mark Vercel deploy as planned.

## 2. Use-case diagram (Figure 1) — comparison, no new scope
| Use case | Implemented? |
|---|---|
| Register / Login | ✔ (Student, **Mentor**, Administrator can log in; diagram links only Student → link the others, as SRS UC-06 states) |
| Search & Filter Mentors (<<include>> View Mentor Profile) | ✔ |
| Send Connection Request | ✔ |
| Accept / Decline Connection Request | ✔ |
| Exchange Messages | ✔ |
| Manage Profile | ✔ |
| Manage Availability | ✔ (add/remove) |
| Request Session / Accept-Decline Session / View Available Timeslot / View Session Status | ✘ (View Available Timeslot: connected students can already *see* slots on the mentor profile) |
| Give Feedback | ✘ |
| Manage Users | ✔ (list/search, deactivate/reactivate) |
| **"Allow Users"** | ✔ as *mentor approval* — **rename** to "Approve Mentor Accounts" so it matches SRS FR-15.6 |
| View Reports & Moderate | ✘ |
No new actor or use case is required. The relationship <<include>>/<<extend>> structure is unchanged.

## 3. ERD (Figure A2) — differences to document or fix
| Planned | Implemented | Action |
|---|---|---|
| `fields` + `mentor_fields` (many-to-many) | `categories` + `mentor_profiles.category_id` (one per mentor) | **Decide**: amend SRS/ERD to "one primary field" **or** add `mentor_fields` junction (changes: migration, `mentor_directory`, profile form, filter). Panel may notice. |
| `profiles.email, bio, avatar_url` | email in `auth.users`; bio in `student_profiles`/`mentor_profiles`; no avatar | Update ERD |
| `current_role`, `organization`, `is_accepting` | `job_title`, `organisation`, `accepting_students` | Rename in ERD (`current_role` is reserved in PostgreSQL) |
| `availability_slots.start_time/end_time` | `starts_at/ends_at` (timestamptz) | Rename |
| — | `mentor_profiles.approval_status, reviewed_by, reviewed_at` | Add to ERD (needed by FR-15.6) |
| `reports`, `sessions`, `feedback` | not created | Mark "not yet implemented" |
| `connections` (unique pair) | partial unique index (pending/accepted) so a declined pair can re-request after 7 days | Note in ERD |

## 4. Data flow note for the slide
Reads: server components → Supabase (user's JWT, RLS). Writes: server actions (zod → Supabase / RPC) except chat insert from the browser. Realtime: browser subscription filtered by `connection_id`, RLS-protected.
