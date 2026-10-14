import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { one } from "@/lib/queries";
import { ActionButton } from "@/components/ActionButton";
import { Avatar, Badge, Empty } from "@/components/Shell";
import { respondConnection } from "@/app/actions/connections";
import { formatDate } from "@/lib/format";

type SP = { institution: string; field_of_study: string; year_of_study: string; interests: string; bio: string };
type Row = {
  id: string; status: "pending" | "accepted" | "declined"; intro_message: string; created_at: string;
  student: { full_name: string; student_profiles: SP | SP[] | null } | { full_name: string; student_profiles: SP | SP[] | null }[] | null;
};

export default async function MentorRequests() {
  const me = await requireRole("mentor");
  const { data, error } = await createClient().from("connections")
    .select("id, status, intro_message, created_at, student:profiles!connections_student_id_fkey(full_name, student_profiles(institution, field_of_study, year_of_study, interests, bio))")
    .eq("mentor_id", me.id).order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const pending = rows.filter((r) => r.status === "pending");
  const others = rows.filter((r) => r.status !== "pending");

  return (
    <>
      <h1 className="text-3xl font-extrabold">Connection requests</h1>
      {error && <p className="field-error mt-3" role="alert">Requests could not be loaded. Please refresh.</p>}
      <div className="mt-4 space-y-3">
        {pending.length === 0 && !error && <Empty title="No pending requests" />}
        {pending.map((r) => {
          const st = one(r.student); const sp = one(st?.student_profiles ?? null);
          return (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={st?.full_name ?? "S"} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{st?.full_name}</p>
                  <p className="text-sm text-muted">{[sp?.institution, sp?.field_of_study, sp?.year_of_study].filter(Boolean).join(" · ") || "Profile not completed yet"}</p>
                  {sp?.interests && <p className="text-sm text-muted">Interests: {sp.interests}</p>}
                  <p className="mt-2 rounded-xl bg-soft p-3 text-sm">“{r.intro_message || "No intro message"}”</p>
                  <p className="mt-1 text-xs text-muted">Received {formatDate(r.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <ActionButton label="Accept" pendingLabel="Accepting…" action={respondConnection.bind(null, r.id, true)} />
                  <ActionButton label="Decline" pendingLabel="Declining…" variant="outline" confirmText="Decline this request? The student can try again after 7 days." action={respondConnection.bind(null, r.id, false)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {others.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-bold">History</h2>
          <div className="mt-3 space-y-2">
            {others.map((r) => (
              <div key={r.id} className="card flex items-center justify-between py-3">
                <span>{one(r.student)?.full_name}</span>
                <span className="flex items-center gap-3">
                  <Badge tone={r.status === "accepted" ? "ok" : "bad"}>{r.status}</Badge>
                  {r.status === "accepted" && <Link href={`/mentor/messages?c=${r.id}`} className="btn btn-sm">Message</Link>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
