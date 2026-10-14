import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StudentProfileForm } from "@/components/forms";

export default async function StudentProfile() {
  const me = await requireRole("student");
  const { data } = await createClient().from("student_profiles").select("*").eq("id", me.id).single();
  return (
    <>
      <h1 className="mb-4 text-3xl font-extrabold">My profile</h1>
      <StudentProfileForm initial={{
        fullName: me.full_name, institution: data?.institution ?? "", fieldOfStudy: data?.field_of_study ?? "",
        yearOfStudy: data?.year_of_study ?? "", interests: data?.interests ?? "", bio: data?.bio ?? "",
      }} />
    </>
  );
}
