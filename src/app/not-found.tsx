import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 text-center">
      <div>
        <h1 className="gls-display text-5xl text-white">Page not found</h1>
        <p className="mt-3 text-gls-body">The link may have expired or the content may have been removed.</p>
        <Link href="/" className="gls-cta mt-5 inline-block rounded px-5 py-2.5">Go home</Link>
      </div>
    </main>
  );
}
