"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { chatMessageSchema } from "@/lib/validation";
import { formatTime } from "@/lib/format";

export interface Msg { id: string; sender_id: string; body: string; created_at: string }

export function ChatClient({ connectionId, meId, otherName, initial }: { connectionId: string; meId: string; otherName: string; initial: Msg[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: Msg[]) => {
    setMsgs((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      incoming.forEach((m) => map.set(m.id, m));
      return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const markRead = useCallback(() => {
    void supabase.rpc("mark_conversation_read", { p_connection_id: connectionId });
  }, [supabase, connectionId]);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("messages").select("id, sender_id, body, created_at")
      .eq("connection_id", connectionId).order("created_at", { ascending: false }).limit(50);
    if (data) merge(data as Msg[]);
  }, [supabase, connectionId, merge]);

  useEffect(() => {
    markRead();
    const channel = supabase
      .channel(`conversation:${connectionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `connection_id=eq.${connectionId}` },
        (payload) => {
          const m = payload.new as Msg;
          merge([m]);
          if (m.sender_id !== meId) markRead();
        })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void refetch(); // FR-09.4: reload anything missed while disconnected
      });
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, connectionId, meId, merge, markRead, refetch]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = chatMessageSchema.safeParse(text);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSending(true); setError(null);
    const { data, error: dbErr } = await supabase
      .from("messages").insert({ connection_id: connectionId, sender_id: meId, body: parsed.data })
      .select("id, sender_id, body, created_at").single();
    setSending(false);
    if (dbErr || !data) { setError("Message not sent. Your text is kept, please try again."); return; } // FR-09.7
    merge([data as Msg]);
    setText("");
  }

  return (
    <div className="card flex h-[28rem] flex-col p-0">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold">{otherName}</h2>
        <span className={`text-xs ${live ? "text-brand" : "text-muted"}`}>{live ? "● Live" : "○ Connecting…"}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {msgs.length === 0 && <p className="text-center text-sm text-muted">No messages yet. Say hello!</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand text-brand-fg" : "bg-soft"}`}>
                {/* React escapes text: FR-16.5 */}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "opacity-80" : "text-muted"}`}>{formatTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="border-t border-line p-3">
        <div className="flex gap-2">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type a message…" aria-label="Message" />
          <button className="btn" disabled={sending} type="submit">{sending ? "…" : "Send"}</button>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </div>
  );
}
