"use client";

export default function ErrorPage({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 text-center">
      <div>
        <h1 className="gls-display text-4xl text-white">Something went wrong</h1>
        <p className="mt-3 text-gls-body">We couldn’t complete that just now. Please try again.</p>
        <button className="gls-cta mt-5 rounded px-5 py-2.5" onClick={unstable_retry}>Try again</button>
      </div>
    </main>
  );
}
