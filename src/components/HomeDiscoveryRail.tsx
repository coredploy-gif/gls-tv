import Link from "next/link";

const DESTINATIONS = [
  {
    href: "/sports",
    eyebrow: "Live now",
    title: "Sports",
    icon: "⚡",
    gradient: "from-red-600 via-orange-500 to-amber-300",
  },
  {
    href: "/live",
    eyebrow: "Around the world",
    title: "Live TV",
    icon: "◉",
    gradient: "from-cyan-500 via-blue-600 to-violet-700",
  },
  {
    href: "/movies",
    eyebrow: "Movie night",
    title: "Movies",
    icon: "▶",
    gradient: "from-fuchsia-600 via-pink-600 to-red-500",
  },
  {
    href: "/series",
    eyebrow: "Binge-worthy",
    title: "Series",
    icon: "+",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
  },
  {
    href: "/library",
    eyebrow: "Your collection",
    title: "My Links",
    icon: "◆",
    gradient: "from-violet-600 via-purple-600 to-fuchsia-500",
  },
] as const;

/** Compact Netflix-style destinations directly below the billboard. */
export function HomeDiscoveryRail() {
  return (
    <section className="gls-home-discovery relative z-20 px-4 pb-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
              Start watching
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              What are you in the mood for?
            </h2>
          </div>
          <Link href="/search" className="shrink-0 text-sm text-white/65 transition hover:text-white">
            <span className="hidden sm:inline">Search everything </span>→
          </Link>
        </div>

        <div className="gls-row-scroll gap-3 pb-2">
          {DESTINATIONS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tv-focus
              data-tv-focus-key={`destination:${item.href}`}
              className="group relative h-28 min-w-[210px] flex-1 overflow-hidden rounded-xl border border-white/15 bg-white/[0.04] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-white/35 hover:shadow-[0_18px_42px_rgba(0,0,0,0.5)] sm:min-w-[230px]"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-25 transition duration-300 group-hover:opacity-45`} />
              <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl transition group-hover:scale-125" />
              <div className="relative flex h-full items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                    {item.eyebrow}
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">{item.title}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/25 text-xl text-white backdrop-blur-md transition group-hover:scale-110 group-hover:bg-white group-hover:text-black">
                  {item.icon}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
