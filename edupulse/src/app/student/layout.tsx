import { Shell } from "@/components/Shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/queries";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("student");
  const unread = await getUnreadCount(createClient(), profile.id);
  return <Shell role="student" name={profile.full_name} unread={unread}>{children}</Shell>;
}
