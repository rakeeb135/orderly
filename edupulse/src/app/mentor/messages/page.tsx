import { requireRole } from "@/lib/auth";
import { MessagesView } from "@/components/MessagesView";

export default async function MentorMessages({ searchParams }: { searchParams: { c?: string } }) {
  const me = await requireRole("mentor");
  return (<><h1 className="mb-4 text-3xl font-extrabold">Messages</h1><MessagesView role="mentor" meId={me.id} selected={searchParams.c} /></>);
}
