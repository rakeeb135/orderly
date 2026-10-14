import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getUnreadCount } from "@/lib/queries";
import { Badge } from "@/components/Shell";

export default async function MentorDashboard() {
  const me = await requireRole("mentor");
  const supabase = createClient();
  const [{ data: mp }, { data: conns }, { count: openSlots }, unread] = await Promise.all([
    supabase.from("mentor_profiles").select("headline, category_id, skills, bio, approval_status, accepting_students").eq("id", me.id).single(),
    supabase.from("connections").select("status").eq("mentor_id", me.id),
    supabase.from("availability_slots").select("id", { count: "exact", head: true }).eq("mentor_id", me.id).eq("status", "open").gt("ends_at", new Date().toISOString()),
    getUnreadCount(supabase, me.id),
  ]);

  const pending = (conns ?? []).filter((c) => c.status === "pending").length;
  const accepted = (conns ?? []).filter((c) => c.status === "accepted").length;
  const checks = [
    ["Headline added", !!mp?.headline?.trim()],
    ["Mentoring field chosen", !!mp?.category_id],
    ["At least one skill", (mp?.skills?.length ?? 0) > 0],
    ["Bio written", !!mp?.bio?.trim()],
  ] as const;
  const done = checks.filter(([, ok]) => ok).length;
  const status = mp?.approval_status ?? "pending";

  return (
    <>
      <p className="font-bold text-brand">MENTOR SPACE</p>
      <h1 className="text-3xl font-extrabold">Welcome, {me.full_name.split(" ")[0]}</h1>

      {status === "pending" && (
        <div className="card mt-4 border-warn"><p className="font-semibold text-warn">Awaiting administrator approval</p>
          <p className="mt-1 text-sm text-muted">Your profile is not listed to students until an administrator approves your account (FR-15.6). Complete your profile to speed this up.</p></div>
      )}
      {status === "rejected" && (
        <div className="card mt-4 border-danger"><p className="font-semibold text-danger">Your mentor application was not approved.</p>
          <p className="mt-1 text-sm text-muted">Please contact the EduPulse administrators for details.</p></div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className="card"><p className="text-3xl font-extrabold">{pending}</p><p className="text-sm text-muted">Pending requests</p></div>
        <div className="card"><p className="text-3xl font-extrabold">{accepted}</p><p className="text-sm text-muted">Connected students</p></div>
        <div className="card"><p className="text-3xl font-extrabold">{openSlots ?? 0}</p><p className="text-sm text-muted">Open slots</p></div>
        <div className="card"><p className="text-3xl font-extrabold">{unread}</p><p className="text-sm text-muted">Unread messages</p></div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Profile completeness</h2><Badge tone={done === checks.length ? "ok" : "warn"}>{done}/{checks.length}</Badge></div>
          <ul className="mt-3 space-y-1 text-sm">{checks.map(([l, ok]) => <li key={l}>{ok ? "✓" : "○"} {l}</li>)}</ul>
          <Link href="/mentor/profile" className="btn btn-outline mt-4">Edit profile</Link>
        </div>
        <div className="card">
          <h2 className="font-semibold">Next actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/mentor/requests" className="btn btn-sm">Review requests</Link>
            <Link href="/mentor/availability" className="btn btn-outline btn-sm">Manage availability</Link>
            <Link href="/mentor/messages" className="btn btn-outline btn-sm">Messages</Link>
          </div>
          {!mp?.accepting_students && <p className="mt-3 text-sm text-warn">You are currently hidden from discovery (not accepting students).</p>}
        </div>
      </div>
    </>
  );
}
