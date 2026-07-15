const PROVIDERS = [
  {
    name: "Rakuten Viki",
    detail: "Licensed Korean dramas with community subtitles. Availability varies by title and region.",
    href: "https://www.viki.com/",
  },
  {
    name: "OnDemandKorea",
    detail: "Korean dramas, variety, and live programming through an official service.",
    href: "https://www.ondemandkorea.com/en/category/drama",
  },
  {
    name: "KBS World",
    detail: "Official Korean broadcaster with international programming and drama content.",
    href: "https://world.kbs.co.kr/service/index.htm?lang=e",
  },
  {
    name: "Arirang TV",
    detail: "Official live Korean culture, entertainment, and current-affairs channel.",
    href: "https://www.arirang.com/live",
  },
] as const;

/** Rights-aware Korean drama discovery alongside GLS's playable Korean channels. */
export function KoreanDramaGuide() {
  return (
    <section className="px-4 pt-5 sm:px-8 lg:px-12">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <p className="gls-eyebrow">Korean drama</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">K-drama, properly sourced</h2>
        <p className="mt-1 max-w-2xl text-sm text-gls-muted">Browse the playable Korean broadcaster channels below, or open a licensed drama service for full seasons and subtitles.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PROVIDERS.map((provider) => (
            <a
              key={provider.name}
              href={provider.href}
              target="_blank"
              rel="noreferrer"
              className="gls-card-lift rounded-xl border border-white/10 bg-black/25 p-4"
            >
              <p className="font-semibold text-white">{provider.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-gls-muted">{provider.detail}</p>
              <p className="mt-4 text-xs font-semibold text-gls-pink-soft">Open service ↗</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
