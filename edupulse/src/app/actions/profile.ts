"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { fieldErrorsFrom, mentorProfileSchema, parseSkills, studentProfileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

export async function updateStudentProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = studentProfileSchema.safeParse({
    fullName: fd.get("fullName"), institution: fd.get("institution"), fieldOfStudy: fd.get("fieldOfStudy"),
    yearOfStudy: fd.get("yearOfStudy"), interests: fd.get("interests"), bio: fd.get("bio") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in first." };

  const a = await supabase.from("profiles").update({ full_name: v.fullName }).eq("id", user.id);
  if (a.error) return { ok: false, error: friendlyError(a.error) };
  const b = await supabase.from("student_profiles")
    .update({ institution: v.institution, field_of_study: v.fieldOfStudy, year_of_study: v.yearOfStudy, interests: v.interests, bio: v.bio })
    .eq("id", user.id);
  if (b.error) return { ok: false, error: friendlyError(b.error) };

  revalidatePath("/student", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function updateMentorProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = mentorProfileSchema.safeParse({
    fullName: fd.get("fullName"), headline: fd.get("headline"), jobTitle: fd.get("jobTitle") ?? "",
    organisation: fd.get("organisation") ?? "", education: fd.get("education") ?? "",
    yearsExperience: fd.get("yearsExperience"), categoryId: fd.get("categoryId"),
    skills: parseSkills(String(fd.get("skills") ?? "")), bio: fd.get("bio") ?? "",
    acceptingStudents: fd.get("acceptingStudents") === "on",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in first." };

  const a = await supabase.from("profiles").update({ full_name: v.fullName }).eq("id", user.id);
  if (a.error) return { ok: false, error: friendlyError(a.error) };
  const b = await supabase.from("mentor_profiles").update({
    headline: v.headline, job_title: v.jobTitle, organisation: v.organisation, education: v.education,
    years_experience: v.yearsExperience, skills: v.skills, bio: v.bio, category_id: v.categoryId,
    accepting_students: v.acceptingStudents,
  }).eq("id", user.id);
  if (b.error) return { ok: false, error: friendlyError(b.error) };

  revalidatePath("/mentor", "layout");
  return { ok: true, message: "Profile saved." };
}
