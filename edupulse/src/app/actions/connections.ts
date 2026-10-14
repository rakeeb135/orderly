"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { connectionMessageSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

const uuid = z.string().uuid();

export async function sendConnectionRequest(mentorId: string, message: string): Promise<ActionState> {
  if (!uuid.safeParse(mentorId).success) return { ok: false, error: "Mentor not found." };
  const m = connectionMessageSchema.safeParse(message ?? "");
  if (!m.success) return { ok: false, error: m.error.issues[0].message };

  const supabase = createClient();
  // All business rules (student-only, approved mentor, duplicates, 7-day cooldown) are enforced inside the RPC.
  const { error } = await supabase.rpc("send_connection_request", { p_mentor_id: mentorId, p_message: m.data });
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/student/mentors/${mentorId}`);
  revalidatePath("/student/connections");
  return { ok: true, message: "Connection request sent." };
}

export async function cancelConnectionRequest(connectionId: string): Promise<ActionState> {
  if (!uuid.safeParse(connectionId).success) return { ok: false, error: "Request not found." };
  const supabase = createClient();
  const { data, error } = await supabase.from("connections").delete().eq("id", connectionId).eq("status", "pending").select("id");
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data || data.length === 0) return { ok: false, error: "This request was already answered, so it cannot be cancelled." };
  revalidatePath("/student", "layout");
  return { ok: true, message: "Request cancelled." };
}

export async function respondConnection(connectionId: string, accept: boolean): Promise<ActionState> {
  if (!uuid.safeParse(connectionId).success) return { ok: false, error: "Request not found." };
  const supabase = createClient();
  const { error } = await supabase.rpc("respond_connection", { p_connection_id: connectionId, p_accept: accept });
  revalidatePath("/mentor", "layout");
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, message: accept ? "Request accepted. You can now message this student." : "Request declined." };
}
