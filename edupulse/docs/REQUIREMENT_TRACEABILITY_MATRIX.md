# REQUIREMENT_TRACEABILITY_MATRIX.md

Status = **code-level** status. "Verified" column says what evidence exists *today*:
**U** = Vitest unit test · **DB** = SQL test on local PostgreSQL 16 (Supabase stub) · **—** = nothing automated · every item is **NOT TESTED live** on Supabase/browser.

Legend: Completed / Partial / Not Started. UI = prototype view that specifies it.

| ID | Requirement | SRS | UI | Frontend | Backend / DB | Verified | Status |
|---|---|---|---|---|---|---|---|
| FR-01.1 | Register as Student/Mentor (name, email, password, role) | FR-01 | register | `RegisterForm`, `signUpAction` | `handle_new_user` trigger | U | Completed |
| FR-01.2 | Email verification before login | FR-01 | register | message + `/auth/callback`, login error text | Supabase Auth setting | — | Partial (no resend) |
| FR-01.3 | Login, session, generic error, deactivated refused | FR-01 | login | `LoginForm`, `signInAction`, middleware | RLS + `is_active` | U, DB(T42) | Completed |
| FR-01.4 | Logout | FR-01 | shell | `signOutAction` | — | — | Completed |
| FR-01.5 | Password reset by email | FR-01 | login | — | — | — | Not Started |
| FR-01.6 | Admin only via controlled process | FR-01 | — | register rejects `admin` | trigger forces student; `seed:demo` promotes | U, DB(T01) | Completed |
| FR-02.1 | One role per account | FR-02 | — | — | `profiles.role` CHECK | DB | Completed |
| FR-02.2 | Redirect unauth; role-only pages; 403 page | FR-02 | — | `middleware.ts`, `requireRole`, `/403` | — | — | Completed |
| FR-02.3 | RLS enforcement | FR-02 | — | — | `002_rls_policies.sql` | DB (T04–T43) | Completed |
| FR-03.1 | Student profile edit | FR-03 | profile | `StudentProfileForm` | `student_profiles` | — | Completed |
| FR-03.2 | Mentor profile edit (limits) | FR-03 | profile | `MentorProfileForm` | `mentor_profiles` CHECKs | U | Completed |
| FR-03.3 | Edit only own profile | FR-03 | — | — | RLS + column grants | DB (T13,T16,T17,T31) | Completed |
| FR-03.4 | Listed only if complete, active, accepting, approved | FR-03 | discover | — | `mentor_directory` view | DB (T04) | Completed |
| FR-03.5 | Profile photo | FR-03 | — | — | — | — | Not Started |
| FR-04.1 | Paginated cards (12/page) | FR-04 | discover | `discover/page.tsx` | view | — | Completed |
| FR-04.2 | Students only | FR-04 | — | middleware/`requireRole` | RLS | DB (T21) | Completed |
| FR-04.3 | Performance target (NFR-03) | FR-04 | — | — | indexes | — | Partial (not measured) |
| FR-05.1 | Keyword search (name, headline, skills, field) | FR-05 | discover | `discover/page.tsx` | ilike on view | U (sanitize) | Completed |
| FR-05.2 | Filter by field + experience range; invalid range rejected | FR-05 | discover | same | — | — | Completed |
| FR-05.3 | Combine + clear filters; empty state | FR-05 | discover | same | — | — | Completed |
| FR-05.4 | Sort name/experience/rating | FR-05 | discover | newest/name/experience | — | — | Partial (no rating) |
| FR-06.1 | Full profile; 404 if unknown | FR-06 | mprofile | `mentors/[id]` | view | — | Completed |
| FR-06.2 | Average rating + count | FR-06 | mprofile | "No reviews yet" | — | — | Partial |
| FR-06.3 | Connection state + matching button | FR-06 | mprofile | `ConnectPanel` | — | — | Completed |
| FR-06.4 | Open slots only to connected students | FR-06 | mprofile | profile page | `slots_read` policy | DB (T32,T36) | Completed |
| FR-07.1 | Send request (≤300 chars, students only, not self) | FR-07 | mprofile | `ConnectPanel` | `send_connection_request` | U, DB (T06,T09,T10) | Completed |
| FR-07.2 | No duplicate pending/accepted | FR-07 | — | error shown | partial unique index + RPC | DB (T07) | Completed |
| FR-07.3 | Cancel pending | FR-07 | conns | `ActionButton` | delete policy | — | Completed |
| FR-07.4 | Re-request only after 7 days | FR-07 | mprofile | date shown | RPC | — | Completed |
| FR-08.1 | Mentor sees pending with student summary | FR-08 | requests | `mentor/requests` | policies | DB (T18–T20) | Completed |
| FR-08.2 | Accept/decline, record time, concurrency message | FR-08 | requests | `ActionButton` | `respond_connection` | DB (T22,T23) | Completed |
| FR-08.3 | Student sees status | FR-08 | conns | `student/connections` | — | — | Completed |
| FR-08.4 | Remove accepted connection | FR-08 | — | — | — | — | Not Started |
| FR-09.1 | Chat only for accepted connections | FR-09 | chat | — | `messages_send` policy | DB (T12,T30,T35) | Completed |
| FR-09.2 | Conversation list + last message | FR-09 | chat | `MessagesView` | — | — | Completed |
| FR-09.3 | Text ≤1000, reject blank, escaped | FR-09 | chat | `ChatClient` | CHECK | U, DB (T28,T29) | Completed |
| FR-09.4 | Realtime delivery + reconnect reload | FR-09 | chat | `ChatClient` (channel + refetch) | publication | — | Completed (**unverified live**) |
| FR-09.5 | Full history in order, pages of 50 | FR-09 | chat | last 50 | index | — | Partial |
| FR-09.6 | Unread indicator | FR-09 | chat | list + nav badge | `mark_conversation_read` | DB (T34) | Completed |
| FR-09.7 | Send error + retry, text kept | FR-09 | chat | `ChatClient` | — | — | Completed |
| FR-10.1 | Create slot (future, 15–120 min) | FR-10 | avail | `AddSlotForm` | CHECK + trigger | U, DB (T25,T26) | Completed |
| FR-10.2 | No overlaps | FR-10 | avail | error text | exclusion constraint | DB (T24) | Completed |
| FR-10.3 | Edit/remove unbooked | FR-10 | avail | remove only | delete policy | — | Partial |
| FR-10.4 | SLT display, hide past | FR-10 | avail | `formatSlt` | `slots_read` | U (slotToIso) | Completed |
| FR-11.1–.3 | Session requests (3) | FR-11 | sessions | — | — | — | Not Started |
| FR-12.1–.4 | Session management (4) | FR-12 | sessions | — | — | — | Not Started |
| FR-13.1–.2 | Session status (2) | FR-13 | sessions | — | — | — | Not Started |
| FR-14.1–.3 | Feedback (3) | FR-14 | sessions | — | — | — | Not Started |
| FR-15.1 | Admin dashboard counts | FR-15 | admin | users + connections | — | — | Partial (no sessions) |
| FR-15.2 | List/search users | FR-15 | users | `admin/users` | `admin_list_users` | DB (T38) | Completed |
| FR-15.3 | Deactivate/reactivate, not self | FR-15 | users | confirm dialog | `admin_set_active` | DB (T40,T41) | Completed |
| FR-15.4 | Report a user; admin resolves | FR-15 | reports | — | — | — | Not Started |
| FR-15.5 | Category management | FR-15 | cats | — | table + seed only | — | Not Started |
| FR-15.6 | Admin approves/rejects mentors | FR-15 | approvals | `admin/approvals` | `admin_review_mentor` | DB (T14,T39) | Completed |
| FR-16.1 | Validate client + server | FR-16 | all | zod; HTML attrs | CHECKs | U | Partial |
| FR-16.2 | Clear success/error messages | FR-16 | all | `FormMessage`, `ActionButton` | `friendlyError` | — | Completed |
| FR-16.3 | No technical details leaked | FR-16 | all | `error.tsx` | `lib/errors.ts` | — | Partial (not exercised) |
| FR-16.4 | Friendly 403/404 | FR-16 | — | `/403`, `not-found` | — | — | Completed |
| FR-16.5 | Escape user text | FR-16 | all | React default escaping | — | — | Completed |

**Totals (67 sub-requirements):** Completed 41 · Partial 9 · Not Started 17 → (41 + 0.5×9) / 67 = **68 % code-level**. This is *not* a claim of verified working software.

### NFR snapshot
| NFR | Status |
|---|---|
| NFR-01 Usability | Not tested with users |
| NFR-02 Responsive (360 px) | Layouts are responsive by construction (Tailwind grids); **not manually checked** |
| NFR-04/05 Security & access control | RLS + route gating implemented; DB-level authorisation tests pass locally |
| NFR-06 Secrets | `.env.example`, service key only in a local script |
| NFR-07 Validation | Partial (see FR-16.1) |
| NFR-09 Maintainability | Modular; lint + typecheck clean |
| NFR-11 Availability / deployment | Not started |
| NFR-12 QA | See `QA_TEST_PLAN.md` |
