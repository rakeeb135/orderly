"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { signInAction, signUpAction } from "@/app/actions/auth";
import { updateMentorProfile, updateStudentProfile } from "@/app/actions/profile";
import { addSlotAction } from "@/app/actions/availability";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui";
import { initialState, type Category } from "@/lib/types";

export function LoginForm({ notice }: { notice?: { text: string; tone: "ok" | "bad" } }) {
  const [state, action] = useFormState(signInAction, initialState);
  return (
    <form action={action} className="card" noValidate>
      <h1 className="text-2xl font-extrabold">Welcome back</h1>
      {notice && <p className={`mt-2 text-sm font-semibold ${notice.tone === "ok" ? "text-brand" : "text-danger"}`} role="status">{notice.text}</p>}
      <label className="label" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" className="input" required />
      <FieldError state={state} name="email" />
      <label className="label" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
      <FieldError state={state} name="password" />
      <FormMessage state={state} />
      <SubmitButton className="mt-4 w-full" pending="Signing in…">Log in</SubmitButton>
      <p className="mt-3 text-center text-sm text-muted">
        New here? <Link href="/register" className="text-brand underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useFormState(signUpAction, initialState);
  if (state.ok) {
    return (
      <div className="card">
        <h1 className="text-2xl font-extrabold">Almost there</h1>
        <p className="mt-3 text-brand" role="status">{state.message}</p>
        <Link href="/login" className="btn mt-4">Go to log in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="card" noValidate>
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <label className="label" htmlFor="fullName">Full name</label>
      <input id="fullName" name="fullName" maxLength={60} className="input" autoComplete="name" required />
      <FieldError state={state} name="fullName" />
      <label className="label" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" className="input" required />
      <FieldError state={state} name="email" />
      <label className="label" htmlFor="password">Password (8+ characters, letter and number)</label>
      <input id="password" name="password" type="password" autoComplete="new-password" className="input" required />
      <FieldError state={state} name="password" />
      <label className="label" htmlFor="role">I am a</label>
      <select id="role" name="role" className="input" defaultValue="student">
        <option value="student">Student</option>
        <option value="mentor">Mentor (reviewed by an administrator before listing)</option>
      </select>
      <FieldError state={state} name="role" />
      <FormMessage state={state} />
      <SubmitButton className="mt-4 w-full" pending="Creating account…">Create account</SubmitButton>
      <p className="mt-3 text-center text-sm text-muted">
        Already registered? <Link href="/login" className="text-brand underline">Log in</Link>
      </p>
    </form>
  );
}

export function StudentProfileForm({ initial }: { initial: { fullName: string; institution: string; fieldOfStudy: string; yearOfStudy: string; interests: string; bio: string } }) {
  const [state, action] = useFormState(updateStudentProfile, initialState);
  return (
    <form action={action} className="card max-w-xl" noValidate>
      <label className="label" htmlFor="fullName">Full name</label>
      <input id="fullName" name="fullName" className="input" maxLength={60} defaultValue={initial.fullName} />
      <FieldError state={state} name="fullName" />
      <label className="label" htmlFor="institution">Institution</label>
      <input id="institution" name="institution" className="input" maxLength={100} defaultValue={initial.institution} />
      <FieldError state={state} name="institution" />
      <label className="label" htmlFor="fieldOfStudy">Field of study</label>
      <input id="fieldOfStudy" name="fieldOfStudy" className="input" maxLength={100} defaultValue={initial.fieldOfStudy} />
      <FieldError state={state} name="fieldOfStudy" />
      <label className="label" htmlFor="yearOfStudy">Year of study</label>
      <input id="yearOfStudy" name="yearOfStudy" className="input" maxLength={30} placeholder="e.g. 3rd year" defaultValue={initial.yearOfStudy} />
      <FieldError state={state} name="yearOfStudy" />
      <label className="label" htmlFor="interests">Interests</label>
      <input id="interests" name="interests" className="input" maxLength={200} defaultValue={initial.interests} />
      <FieldError state={state} name="interests" />
      <label className="label" htmlFor="bio">Short bio (max 500 characters)</label>
      <textarea id="bio" name="bio" rows={4} className="input" maxLength={500} defaultValue={initial.bio} />
      <FieldError state={state} name="bio" />
      <FormMessage state={state} />
      <SubmitButton className="mt-4" pending="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function MentorProfileForm({ categories, initial }: {
  categories: Category[];
  initial: { fullName: string; headline: string; jobTitle: string; organisation: string; education: string; yearsExperience: number; categoryId: string; skills: string; bio: string; acceptingStudents: boolean };
}) {
  const [state, action] = useFormState(updateMentorProfile, initialState);
  return (
    <form action={action} className="card max-w-xl" noValidate>
      <label className="label" htmlFor="fullName">Full name</label>
      <input id="fullName" name="fullName" className="input" maxLength={60} defaultValue={initial.fullName} />
      <FieldError state={state} name="fullName" />
      <label className="label" htmlFor="headline">Headline</label>
      <input id="headline" name="headline" className="input" maxLength={120} placeholder="e.g. Senior Software Engineer" defaultValue={initial.headline} />
      <FieldError state={state} name="headline" />
      <label className="label" htmlFor="jobTitle">Current role</label>
      <input id="jobTitle" name="jobTitle" className="input" maxLength={100} defaultValue={initial.jobTitle} />
      <label className="label" htmlFor="organisation">Organisation</label>
      <input id="organisation" name="organisation" className="input" maxLength={100} defaultValue={initial.organisation} />
      <label className="label" htmlFor="education">Education</label>
      <input id="education" name="education" className="input" maxLength={150} defaultValue={initial.education} />
      <label className="label" htmlFor="yearsExperience">Years of experience (0–60)</label>
      <input id="yearsExperience" name="yearsExperience" type="number" min={0} max={60} className="input" defaultValue={initial.yearsExperience} />
      <FieldError state={state} name="yearsExperience" />
      <label className="label" htmlFor="categoryId">Mentoring field</label>
      <select id="categoryId" name="categoryId" className="input" defaultValue={initial.categoryId}>
        <option value="" disabled>Choose a field…</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <FieldError state={state} name="categoryId" />
      <label className="label" htmlFor="skills">Skills (comma separated, up to 10)</label>
      <input id="skills" name="skills" className="input" defaultValue={initial.skills} placeholder="React, Node.js, System Design" />
      <FieldError state={state} name="skills" />
      <label className="label" htmlFor="bio">Bio (max 800 characters)</label>
      <textarea id="bio" name="bio" rows={5} className="input" maxLength={800} defaultValue={initial.bio} />
      <FieldError state={state} name="bio" />
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="acceptingStudents" defaultChecked={initial.acceptingStudents} className="h-4 w-4 w-auto" />
        Accepting new students
      </label>
      <FormMessage state={state} />
      <SubmitButton className="mt-4" pending="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function AddSlotForm() {
  const [state, action] = useFormState(addSlotAction, initialState);
  return (
    <form action={action} className="card" noValidate>
      <h2 className="font-semibold">Publish a time slot (Sri Lanka time)</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" className="input" required /></div>
        <div><label className="label" htmlFor="start">Start</label><input id="start" name="start" type="time" className="input" required /></div>
        <div><label className="label" htmlFor="end">End</label><input id="end" name="end" type="time" className="input" required /></div>
      </div>
      <p className="mt-2 text-xs text-muted">Slots must be in the future, 15–120 minutes long, and must not overlap.</p>
      <FormMessage state={state} />
      <SubmitButton className="mt-3" pending="Publishing…">Add slot</SubmitButton>
    </form>
  );
}
