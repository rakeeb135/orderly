import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getUnreadCount, one } from "@/lib/queries";
import { Badge, Empty } from "@/components/Shell";

export default async function StudentDashboard() {
  const me = await requireRole("student");
  const supabase = createClient();
  const [{ data: conns }, unread] = await Promise.all([
    supabase.from("connections")
      .select("id, status, created_at, mentor:profiles!connections_mentor_id_fkey(full_name)")
      .eq("student_id", me.id).order("created_at", { ascending: false }),
    getUnreadCount(supabase, me.id),
  ]);
  const list = (conns ?? []) as unknown as { id: string; status: string; mentor: { full_name: string } | { full_name: string }[] | null }[];
  const pending = list.filter((c) => c.status === "pending").length;
  const accepted = list.filter((c) => c.status === "accepted");

  return (
    <>
      <p className="font-bold text-brand">STUDENT SPACE</p>
      <h1 className="text-3xl font-extrabold">Welcome back, {me.full_name.split(" ")[0]}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card"><p className="text-3xl font-extrabold">{accepted.length}</p><p className="text-sm text-muted">Connected mentors</p></div>
        <div className="card"><p className="text-3xl font-extrabold">{pending}</p><p className="text-sm text-muted">Pending requests</p></div>
        <div className="card"><p className="text-3xl font-extrabold">{unread}</p><p className="text-sm text-muted">Unread messages</p></div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Find your next mentor</h2>
          <p className="mt-1 text-sm text-muted">Search approved mentors by keyword, field and experience.</p>
          <Link href="/student/discover" className="btn mt-4">Browse mentors</Link>
        </div>
        <div className="card">
          <h2 className="font-semibold">Your mentors</h2>
          {accepted.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No accepted connections yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {accepted.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span>{one(c.mentor)?.full_name}</span>
                  <Link href={`/student/messages?c=${c.id}`} className="btn btn-outline btn-sm">Chat</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-6"><Empty title="Sessions & feedback"><Badge tone="muted">Planned for the next phase</Badge></Empty></div>
    </>
  );
}
