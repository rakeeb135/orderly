import { requireRole } from "@/lib/auth";
import { MessagesView } from "@/components/MessagesView";

export default async function StudentMessages({ searchParams }: { searchParams: { c?: string } }) {
  const me = await requireRole("student");
  return (<><h1 className="mb-4 text-3xl font-extrabold">Messages</h1><MessagesView role="student" meId={me.id} selected={searchParams.c} /></>);
}
