import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChatClient, type Msg } from "@/components/ChatClient";
import { Avatar, Empty } from "@/components/Shell";
import { one } from "@/lib/queries";
import type { Role } from "@/lib/types";

type Conn = {
  id: string;
  student: { full_name: string } | { full_name: string }[] | null;
  mentor: { full_name: string } | { full_name: string }[] | null;
};

export async function MessagesView({ role, meId, selected }: { role: Role; meId: string; selected?: string }) {
  const supabase = createClient();
  const base = role === "student" ? "/student" : "/mentor";

  const { data, error } = await supabase
    .from("connections")
    .select("id, student:profiles!connections_student_id_fkey(full_name), mentor:profiles!connections_mentor_id_fkey(full_name)")
    .eq("status", "accepted");

  if (error) return <Empty title="Messages could not be loaded.">Please refresh the page to retry.</Empty>;

  const convs = ((data ?? []) as unknown as Conn[]).map((c) => ({
    id: c.id,
    other: (role === "student" ? one(c.mentor)?.full_name : one(c.student)?.full_name) ?? "Unknown user",
  }));

  if (convs.length === 0) {
    return (
      <Empty title="No conversations yet">
        {role === "student" ? (
          <>Once a mentor accepts your request you can chat here. <Link className="text-brand underline" href="/student/discover">Find a mentor</Link>.</>
        ) : (
          <>Accept a student&apos;s request to start a conversation.</>
        )}
      </Empty>
    );
  }

  const ids = convs.map((c) => c.id);
  const { data: recent } = await supabase
    .from("messages").select("connection_id, sender_id, body, created_at, read_at")
    .in("connection_id", ids).order("created_at", { ascending: false }).limit(300);
  const last = new Map<string, string>();
  const unread = new Map<string, number>();
  (recent ?? []).forEach((m) => {
    if (!last.has(m.connection_id)) last.set(m.connection_id, m.body);
    if (m.sender_id !== meId && !m.read_at) unread.set(m.connection_id, (unread.get(m.connection_id) ?? 0) + 1);
  });

  const active = convs.find((c) => c.id === selected) ?? convs[0];
  const { data: history } = await supabase
    .from("messages").select("id, sender_id, body, created_at")
    .eq("connection_id", active.id).order("created_at", { ascending: false }).limit(50);
  const initial = ((history ?? []) as Msg[]).slice().reverse();

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <aside aria-label="Conversations" className="card space-y-1 p-2">
        {convs.map((c) => (
          <Link key={c.id} href={`${base}/messages?c=${c.id}`}
            className={`flex items-center gap-3 rounded-xl p-2 hover:bg-soft ${c.id === active.id ? "bg-soft" : ""}`}>
            <Avatar name={c.other} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.other}</p>
              <p className="truncate text-xs text-muted">{last.get(c.id) ?? "No messages yet"}</p>
            </div>
            {(unread.get(c.id) ?? 0) > 0 && <span className="rounded-full bg-danger px-1.5 text-xs text-white">{unread.get(c.id)}</span>}
          </Link>
        ))}
      </aside>
      <ChatClient key={active.id} connectionId={active.id} meId={meId} otherName={active.other} initial={initial} />
    </div>
  );
}
