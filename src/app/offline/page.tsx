export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
        GLS TV
      </p>
      <h1 className="gls-display mt-3 text-4xl text-white sm:text-5xl">
        You’re offline
      </h1>
      <p className="mt-3 text-gls-body">
        Live streams, My Links, account changes, and payments need a connection.
        Reconnect, then reload this page.
      </p>
      <ul className="mt-6 space-y-2 text-left text-sm text-gls-muted">
        <li>· Shell pages may still open from cache</li>
        <li>· Playback and billing stay network-only (by design)</li>
        <li>· After reconnect, return to Home or My Links</li>
      </ul>
      <a
        href="/browse"
        className="gls-cta mt-8 inline-flex rounded-lg px-6 py-3 text-sm font-semibold"
      >
        Try Home again
      </a>
    </main>
  );
}
