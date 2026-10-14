"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendConnectionRequest, cancelConnectionRequest } from "@/app/actions/connections";
import { formatDate } from "@/lib/format";

export type ConnState =
  | { kind: "none" }
  | { kind: "pending"; id: string }
  | { kind: "accepted"; id: string }
  | { kind: "declined"; retryAt: string };

/** FR-06.3: shows the connection state and the matching action. */
export function ConnectPanel({ mentorId, state }: { mentorId: string; state: ConnState }) {
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const canRetry = state.kind === "declined" && new Date(state.retryAt) <= new Date();

  if (state.kind === "accepted") {
    return (
      <div>
        <p className="font-semibold text-brand">✓ You are connected</p>
        <Link href={`/student/messages?c=${state.id}`} className="btn mt-3">Open chat</Link>
      </div>
    );
  }
  if (state.kind === "pending") {
    return (
      <div>
        <p className="font-semibold text-warn">Request sent – waiting for the mentor</p>
        <button className="btn btn-outline btn-sm mt-3" disabled={pending}
          onClick={() => start(async () => { const r = await cancelConnectionRequest(state.id); setResult({ ok: r.ok, text: r.error ?? r.message ?? "" }); router.refresh(); })}>
          {pending ? "Cancelling…" : "Cancel request"}
        </button>
        {result && !result.ok && <p className="field-error" role="alert">{result.text}</p>}
      </div>
    );
  }
  if (state.kind === "declined" && !canRetry) {
    return <p className="text-sm text-muted">This mentor declined your last request. You can send a new request after {formatDate(state.retryAt)}.</p>;
  }
  return (
    <div>
      <label htmlFor="intro" className="label mt-0">Intro message (optional, max 300 characters)</label>
      <textarea id="intro" className="input" rows={3} maxLength={300} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Tell the mentor what you would like guidance on…" />
      <p className="mt-1 text-xs text-muted">{msg.length}/300</p>
      <button className="btn mt-3" disabled={pending}
        onClick={() => start(async () => { const r = await sendConnectionRequest(mentorId, msg); setResult({ ok: r.ok, text: r.error ?? r.message ?? "" }); router.refresh(); })}>
        {pending ? "Sending…" : "Send connection request"}
      </button>
      {result && <p className={result.ok ? "mt-2 text-sm font-semibold text-brand" : "field-error"} role={result.ok ? "status" : "alert"}>{result.text}</p>}
    </div>
  );
}
