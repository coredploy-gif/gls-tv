"use client";

import Link from "next/link";

export default function PlaylistWatchError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 text-center">
      <div>
        <h1 className="gls-display text-4xl text-white">
          Unable to open this channel
        </h1>
        <p className="mt-3 text-gls-body">
          Please try again, or choose another channel from your playlists.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            className="gls-cta rounded px-5 py-2.5"
            onClick={unstable_retry}
          >
            Try again
          </button>
          <Link
            href="/playlists"
            className="rounded border border-white/20 px-5 py-2.5 font-semibold text-white transition hover:border-white/45 hover:bg-white/10"
          >
            My Playlists
          </Link>
        </div>
      </div>
    </main>
  );
}
