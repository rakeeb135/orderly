import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-3xl font-extrabold">404 – Page not found</h1>
      <p className="mt-3 text-muted">We could not find what you were looking for.</p>
      <Link href="/" className="btn mt-6">Back to home</Link>
    </main>
  );
}
