import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { AddSlotForm } from "@/components/forms";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Empty } from "@/components/Shell";
import { removeSlotAction } from "@/app/actions/availability";
import { durationMins, formatSlt } from "@/lib/format";

export default async function MentorAvailability() {
  const me = await requireRole("mentor");
  const { data, error } = await createClient().from("availability_slots")
    .select("id, starts_at, ends_at, status").eq("mentor_id", me.id)
    .gt("ends_at", new Date().toISOString()).order("starts_at");
  const slots = data ?? [];

  return (
    <>
      <h1 className="text-3xl font-extrabold">Availability</h1>
      <div className="mt-4"><AddSlotForm /></div>
      <h2 className="mt-8 text-xl font-bold">Upcoming slots</h2>
      {error && <p className="field-error mt-2" role="alert">Slots could not be loaded. Please refresh.</p>}
      <div className="mt-3 space-y-2">
        {slots.length === 0 && !error && <Empty title="No upcoming slots">Publish a slot above so connected students can see when you are free.</Empty>}
        {slots.map((s) => (
          <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
            <span>{formatSlt(s.starts_at)} · {durationMins(s.starts_at, s.ends_at)} min</span>
            <span className="flex items-center gap-3">
              <Badge tone={s.status === "open" ? "ok" : "warn"}>{s.status}</Badge>
              {s.status === "open"
                ? <ActionButton variant="outline" label="Remove" pendingLabel="Removing…" confirmText="Remove this slot?" action={removeSlotAction.bind(null, s.id)} />
                : <span className="text-xs text-muted">Booked slots cannot be removed</span>}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
