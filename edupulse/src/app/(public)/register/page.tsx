import { PublicTop } from "@/components/Shell";
import { RegisterForm } from "@/components/forms";

export default function RegisterPage() {
  return (
    <>
      <PublicTop />
      <main className="mx-auto max-w-md px-5 py-10"><RegisterForm /></main>
    </>
  );
}
