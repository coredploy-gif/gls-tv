"use client";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 text-center">
      <div>
        <h1 className="gls-display text-4xl text-white">Something went wrong</h1>
        <p className="mt-3 text-gls-body">The request could not be completed. No payment or account action should be assumed complete until its page confirms it.</p>
        {error.digest && <p className="mt-2 text-xs text-gls-muted">Reference: {error.digest}</p>}
        <button className="gls-cta mt-5 rounded px-5 py-2.5" onClick={unstable_retry}>Try again</button>
      </div>
    </main>
  );
}
