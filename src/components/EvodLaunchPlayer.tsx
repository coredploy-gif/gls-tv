/**
 * eVOD refuses cross-origin iframes (X-Frame-Options: SAMEORIGIN).
 * Launch the official watch.evod.co.za page instead of VideoPlayer / iframe.
 */
export function EvodLaunchPlayer({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#1a1208] to-black px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e85d04]">
        eVOD · e.tv
      </p>
      <h2 className="max-w-lg text-xl font-semibold text-white sm:text-2xl">
        {title}
      </h2>
      <p className="max-w-md text-sm text-gls-muted">
        eVOD (including live eExtra) must open on the official site — it blocks
        embedding in other apps. Sign in with your phone number on eVOD if
        prompted.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="gls-cta rounded-lg px-6 py-3 text-sm font-semibold"
      >
        Open on eVOD
      </a>
      <p className="max-w-sm truncate text-xs text-gls-muted">{url}</p>
    </div>
  );
}
