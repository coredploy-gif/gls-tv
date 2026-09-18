const PALETTES = [
  ["#ff3b6b", "#ff9f43", "#ffe66d"],
  ["#00d4ff", "#7c5cff", "#ff4ecd"],
  ["#35f2a1", "#00b8d9", "#6c63ff"],
  ["#ff6b35", "#f72585", "#7209b7"],
  ["#ffd166", "#06d6a0", "#118ab2"],
] as const;

function paletteFor(title: string) {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTES[hash % PALETTES.length];
}

/** Readable channel identity overlay shared by live catalog and My Links cards. */
export function ChannelNamePlate({
  title,
  compact = false,
}: {
  title: string;
  compact?: boolean;
}) {
  const colors = paletteFor(title);
  return (
    <div className="pointer-events-none absolute inset-x-3 top-1/2 z-[2] -translate-y-1/2 text-center">
      <div
        className={`mx-auto inline-flex max-w-full items-center justify-center rounded-xl border border-white/25 bg-black/65 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-md ${
          compact ? "px-3 py-2" : "px-3 py-2.5 sm:px-4"
        }`}
      >
        <span
          className={`gls-display line-clamp-2 bg-clip-text font-black uppercase leading-[0.95] tracking-wide text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
            compact ? "text-xl" : "text-xl sm:text-2xl"
          }`}
          style={{
            backgroundImage: `linear-gradient(100deg, ${colors[0]}, ${colors[1]} 52%, ${colors[2]})`,
          }}
        >
          {title}
        </span>
      </div>
    </div>
  );
}
