import { PublicTop } from "@/components/Shell";
import { LoginForm } from "@/components/forms";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; verified?: string } }) {
  let notice: { text: string; tone: "ok" | "bad" } | undefined;
  if (searchParams.verified) notice = { text: "Email verified. You can log in now.", tone: "ok" };
  else if (searchParams.error === "deactivated") notice = { text: "This account has been deactivated.", tone: "bad" };
  else if (searchParams.error === "verification") notice = { text: "The verification link is invalid or expired. Please register again or request a new link.", tone: "bad" };
  else if (searchParams.error === "noprofile") notice = { text: "Your account profile could not be loaded.", tone: "bad" };
  return (
    <>
      <PublicTop />
      <main className="mx-auto max-w-md px-5 py-10"><LoginForm notice={notice} /></main>
    </>
  );
}
