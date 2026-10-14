import Link from "next/link";
import { PublicTop } from "@/components/Shell";

const STEPS = [
  ["1. Join & build a profile", "Register as a student or mentor and describe your goals or expertise."],
  ["2. Discover mentors", "Search and filter approved mentors by field, skill and experience."],
  ["3. Connect & chat", "Send a connection request. Once accepted, chat in real time."],
];

export default function Home() {
  return (
    <>
      <PublicTop />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <section className="max-w-2xl">
          <p className="font-bold text-brand">Student–Professional Mentoring Platform</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight">Connecting students with the guidance they need to succeed.</h1>
          <p className="mt-4 text-lg text-muted">
            EduPulse bridges academic learning and real-world industry experience by connecting students with mentors who can guide their career journey.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="btn">Find a Mentor</Link>
            <Link href="/register" className="btn btn-outline">Become a Mentor</Link>
          </div>
        </section>
        <h2 className="mt-14 text-center text-2xl font-extrabold">How EduPulse works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([t, d]) => (
            <div key={t} className="card"><h3 className="font-semibold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>
          ))}
        </div>
        <p className="mt-10 text-center text-xs text-muted">
          Mentors are reviewed and approved by an administrator before they are listed.
        </p>
      </main>
    </>
  );
}
