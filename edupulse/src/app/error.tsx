"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-3 text-muted">The page could not be loaded. Please try again.</p>
      <button onClick={reset} className="btn mt-6">Retry</button>
    </main>
  );
}
