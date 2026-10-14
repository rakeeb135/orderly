import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import type { Role } from "@/lib/types";

const NAV: Record<Role, [string, string][]> = {
  student: [["/student/dashboard", "Dashboard"], ["/student/discover", "Find mentors"], ["/student/connections", "Connections"], ["/student/messages", "Messages"], ["/student/profile", "Profile"]],
  mentor: [["/mentor/dashboard", "Dashboard"], ["/mentor/requests", "Requests"], ["/mentor/availability", "Availability"], ["/mentor/messages", "Messages"], ["/mentor/profile", "Profile"]],
  admin: [["/admin/dashboard", "Overview"], ["/admin/approvals", "Mentor approvals"], ["/admin/users", "Users"]],
};

export function Shell({ role, name, unread = 0, children }: { role: Role; name: string; unread?: number; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2">
            <Link href={NAV[role][0][0]} className="text-xl font-extrabold text-brand">EduPulse</Link>
            <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold text-brand">{role}</span>
          </div>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {NAV[role].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-soft hover:text-brand">
                {label}
                {label === "Messages" && unread > 0 && (
                  <span className="ml-1 rounded-full bg-danger px-1.5 text-xs text-white">{unread}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{name}</span>
            <form action={signOutAction}>
              <button className="btn btn-outline btn-sm" type="submit">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6">{children}</main>
    </>
  );
}

export function PublicTop() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="text-xl font-extrabold text-brand">EduPulse</Link>
        <div className="flex gap-2">
          <Link href="/login" className="btn btn-outline btn-sm">Log in</Link>
          <Link href="/register" className="btn btn-sm">Join EduPulse</Link>
        </div>
      </div>
    </header>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <div aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-soft text-lg font-bold text-brand">
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function Badge({ children, tone = "ok" }: { children: React.ReactNode; tone?: "ok" | "warn" | "bad" | "muted" }) {
  const t = { ok: "bg-soft text-brand", warn: "bg-soft text-warn", bad: "bg-soft text-danger", muted: "bg-soft text-muted" }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
