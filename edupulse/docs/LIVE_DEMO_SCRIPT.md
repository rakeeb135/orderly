# LIVE_DEMO_SCRIPT.md — ~2 minutes, only features that genuinely work

**Do not use this script until QA §B (12-step live smoke test) has passed on the machine you will present from.** If a step fails in rehearsal, cut it from the demo and mark it Partial in the slides.

## Before you go on (checklist)
- Supabase project up; `npm run seed:demo` done; `.env.local` set; `npm run dev` running (or Vercel URL once deployed).
- **Two browsers**: normal window (Alex, student) and incognito/second profile (Sarah, mentor). A third tab logged in as `admin@edupulse.lk`, on `/admin/approvals`.
- Reset state: delete Alex↔Sarah connection/messages in the Supabase table editor (so the request flow is fresh). Ensure Ayesha is `pending`.
- Supabase Table Editor open on `connections` and `messages` in a separate tab.
- Zoom browser to 110–125 %. Silence notifications. Wi-Fi checked; phone hotspot ready.

## Sequence
| # | Open / click | Demonstrate | DB operation that occurs | Panel should notice | Say |
|---|---|---|---|---|---|
| 1 | Alex window → `/login` → log in | Real auth, role redirect | Supabase Auth session; `profiles` read | Lands on *Student* dashboard (not a demo button) | "This is real Supabase Authentication, not a mocked login." |
| 2 | **Find mentors** → type `react` → Search; then pick field "Data Science", clear filters | Search + filter + empty/clear | `SELECT` on `mentor_directory` view | Ayesha (pending) is **not** listed | "Only administrator-approved mentors appear — that answers the supervisor's reliability concern (FR-15.6)." |
| 3 | Open **Sarah Fernando** | Profile, "Connect to view availability" | reads `mentor_profiles` + connection state | Availability hidden before connecting (FR-06.4) | "Slots are protected by row-level security, not just hidden in the UI." |
| 4 | Type a short intro → **Send connection request** | Request created; button turns to "Request sent" | `INSERT connections(status='pending')` via RPC | Tab 2 (Table Editor) shows the new row | "Duplicates are blocked by a database unique index and by the RPC." |
| 5 | Sarah window → **Requests** | Student summary + message → **Accept** | RPC `respond_connection` → `status='accepted'` | Mentor sees only her own requests | "Only the mentor of that request can answer it." |
| 6 | Alex → **Messages** → send "Hello Sarah"; Sarah's chat shows it **without refresh**; she replies | Realtime chat | `INSERT messages`, Realtime event, `mark_conversation_read` | Live indicator "● Live"; message appears instantly | "Supabase Realtime under RLS — only the two participants receive it." |
| 7 | Sarah → **Availability** → add slot tomorrow 10:00–11:00; try overlapping 10:30–11:30 | Validation + constraint | `INSERT availability_slots`; second insert rejected by exclusion constraint | Friendly overlap error | "Overlaps are prevented in the database itself." |
| 8 | Alex → Sarah's profile again | Slot now visible | RLS `slots_read` allows (accepted connection) | Contrast with step 3 | "Visible only after acceptance." |
| 9 | Admin tab → **Approvals** → approve Ayesha *(optional if time)* | Admin workflow | RPC `admin_review_mentor` | She now appears in Alex's discovery | "Mentor legitimacy is an admin-gated workflow." |

## What to say about status (30 s, after demo)
"Working today: auth, roles, profiles, discovery, connection workflow, realtime chat, availability, admin approval. Not yet built: session requests, feedback, reports, password reset, deployment. Testing is in progress; we have unit tests and database security tests, and live end-to-end test results are recorded in our QA plan."  *(Say the last sentence only if it is true.)*

## Backup plan
| Failure | Action |
|---|---|
| Wi-Fi/Supabase down | Switch to phone hotspot; if still down, show pre-recorded screen capture (record it during the rehearsal; say it is a recording) + Supabase tables screenshot. |
| Realtime message does not appear | Refresh Sarah's tab (history loads from DB), say "history is persisted; realtime reconnect is something we are verifying". Do not pretend it worked. |
| Login error | Use the other seeded account; check email-confirmation setting. |
| App crash | `npm run dev` restart (have the terminal ready); otherwise recording. |
| Time almost over | Skip steps 7–9; keep 1–6. |
