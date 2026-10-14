import { Shell } from "@/components/Shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/queries";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("mentor");
  const unread = await getUnreadCount(createClient(), profile.id);
  return <Shell role="mentor" name={profile.full_name} unread={unread}>{children}</Shell>;
}
