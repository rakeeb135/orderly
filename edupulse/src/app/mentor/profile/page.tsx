import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MentorProfileForm } from "@/components/forms";
import { Badge } from "@/components/Shell";
import type { Category } from "@/lib/types";

export default async function MentorProfile() {
  const me = await requireRole("mentor");
  const supabase = createClient();
  const [{ data: mp }, { data: cats }] = await Promise.all([
    supabase.from("mentor_profiles").select("*").eq("id", me.id).single(),
    supabase.from("categories").select("id, name, is_active").eq("is_active", true).order("name"),
  ]);
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-3xl font-extrabold">My profile</h1>
        <Badge tone={mp?.approval_status === "approved" ? "ok" : mp?.approval_status === "rejected" ? "bad" : "warn"}>{mp?.approval_status ?? "pending"}</Badge>
      </div>
      <MentorProfileForm
        categories={(cats ?? []) as Category[]}
        initial={{
          fullName: me.full_name, headline: mp?.headline ?? "", jobTitle: mp?.job_title ?? "", organisation: mp?.organisation ?? "",
          education: mp?.education ?? "", yearsExperience: mp?.years_experience ?? 0, categoryId: mp?.category_id ?? "",
          skills: (mp?.skills ?? []).join(", "), bio: mp?.bio ?? "", acceptingStudents: mp?.accepting_students ?? true,
        }}
      />
    </>
  );
}
