import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { one } from "@/lib/queries";
import { ActionButton } from "@/components/ActionButton";
import { Avatar, Badge, Empty } from "@/components/Shell";
import { cancelConnectionRequest } from "@/app/actions/connections";
import { formatDate } from "@/lib/format";

type Row = { id: string; status: "pending" | "accepted" | "declined"; intro_message: string; created_at: string; responded_at: string | null; mentor_id: string; mentor: { full_name: string } | { full_name: string }[] | null };

export default async function StudentConnections() {
  const me = await requireRole("student");
  const { data, error } = await createClient().from("connections")
    .select("id, status, intro_message, created_at, responded_at, mentor_id, mentor:profiles!connections_mentor_id_fkey(full_name)")
    .eq("student_id", me.id).order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <h1 className="text-3xl font-extrabold">My connections</h1>
      {error && <p className="field-error mt-3" role="alert">Connections could not be loaded. Please refresh.</p>}
      <div className="mt-4 space-y-3">
        {rows.length === 0 && !error && <Empty title="No requests yet"><Link href="/student/discover" className="text-brand underline">Find a mentor</Link> and send your first request.</Empty>}
        {rows.map((c) => {
          const name = one(c.mentor)?.full_name ?? "Mentor";
          return (
            <div key={c.id} className="card flex flex-wrap items-center gap-4">
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <Link href={`/student/mentors/${c.mentor_id}`} className="font-semibold hover:underline">{name}</Link>
                <p className="truncate text-sm text-muted">{c.intro_message || "No intro message"} · sent {formatDate(c.created_at)}</p>
              </div>
              <Badge tone={c.status === "accepted" ? "ok" : c.status === "pending" ? "warn" : "bad"}>{c.status}</Badge>
              {c.status === "pending" && <ActionButton variant="outline" label="Cancel" pendingLabel="Cancelling…" action={cancelConnectionRequest.bind(null, c.id)} confirmText="Cancel this request?" />}
              {c.status === "accepted" && <Link href={`/student/messages?c=${c.id}`} className="btn btn-sm">Message</Link>}
            </div>
          );
        })}
      </div>
    </>
  );
}
