import Link from "next/link";
import { GlsLogo } from "@/components/GlsLogo";
import { GLS_PLANS } from "@/lib/membership/plans";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gls-black text-white">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=2400&q=90"
          alt=""
          className="gls-kenburns h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/60 to-gls-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.18),transparent_55%)]" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-10">
        <GlsLogo size="md" href="/" shimmer glass />
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="hidden text-sm text-gls-muted transition hover:text-gls-pink-soft sm:inline"
          >
            Plans
          </Link>
          <Link
            href="/faq"
            className="hidden text-sm text-gls-muted transition hover:text-white sm:inline"
          >
            FAQ
          </Link>
          <Link
            href="/legal"
            className="hidden text-sm text-gls-muted transition hover:text-white sm:inline"
          >
            Legal
          </Link>
          <Link
            href="/auth"
            className="gls-cta rounded-full px-4 py-1.5 text-sm sm:px-5 sm:py-2"
          >
            Sign In
          </Link>
        </div>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-88px)] flex-col items-center justify-center px-6 pb-12 text-center">
        <span className="gls-animate-in gls-eyebrow" style={{ animationDelay: "40ms" }}>
          Your entertainment, elevated
        </span>
        <GlsLogo size="hero" href={null} glass />
        <span className="gls-animate-in gls-quality-pill mt-5" style={{ animationDelay: "80ms" }}>4K READY</span>
        <p
          className="gls-animate-in mt-6 max-w-xl text-base text-gls-body sm:text-xl"
          style={{ animationDelay: "120ms" }}
        >
          Live sports, series, and your playlists — cinematic 4K-ready streaming.
          Start free for 14 days.
        </p>
        <div
          className="gls-animate-in mt-10 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "220ms" }}
        >
          <Link
            href="/auth?mode=signup"
            className="gls-cta inline-flex h-14 items-center rounded px-8 text-lg"
          >
            Start free trial
          </Link>
          <Link
            href="/auth"
            className="gls-cta-ghost inline-flex h-14 items-center rounded px-7 text-lg"
          >
            Sign in
          </Link>
        </div>
        <div
          className="gls-animate-in mt-12 grid grid-cols-3 gap-5 text-left sm:gap-9"
          style={{ animationDelay: "320ms" }}
        >
          <div className="gls-stat">
            <p className="text-sm font-semibold text-white">Live & on demand</p>
            <p className="mt-1 text-xs text-gls-muted">One seamless library</p>
          </div>
          <div className="gls-stat">
            <p className="text-sm font-semibold text-white">Made for every screen</p>
            <p className="mt-1 text-xs text-gls-muted">Pick up where you left off</p>
          </div>
          <div className="gls-stat">
            <p className="text-sm font-semibold text-white">Your space</p>
            <p className="mt-1 text-xs text-gls-muted">Profiles and playlists</p>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <p className="gls-eyebrow justify-center">Membership</p>
        <h2 className="gls-display mt-3 text-center text-3xl text-white sm:text-4xl">Pick your plan</h2>
        <p className="mt-2 text-center text-sm text-gls-muted">
          Every plan includes a Kids profile. 14-day trial first.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {GLS_PLANS.map((p, i) => (
            <Link
              key={p.id}
              href="/auth?mode=signup"
              className={`gls-glass gls-card-lift group relative rounded-2xl p-6 ${i === 1 ? "border-gls-pink/45" : ""}`}
            >
              {i === 1 && (
                <span className="absolute right-4 top-4 rounded-full bg-gls-pink/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gls-pink-soft ring-1 ring-gls-pink/30">
                  Popular
                </span>
              )}
              <p
                className="text-xs font-bold uppercase tracking-[0.25em]"
                style={{
                  color: i === 1 ? "#ffffff" : "#d4d4d4",
                }}
              >
                {p.name}
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                R{p.priceZar}
                <span className="text-base font-normal text-gls-muted">
                  /mo
                </span>
              </p>
              <p className="mt-2 text-sm text-gls-body">{p.badge}</p>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-white/45">Cancel any time. No long-term contracts.</p>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-6 py-7 text-center text-xs text-gls-muted">
        <p>GLS TV · A better way to find your next watch.</p>
        <p className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/faq" className="hover:text-white hover:underline">
            FAQ
          </Link>
          <Link href="/pricing" className="hover:text-white hover:underline">
            Plans
          </Link>
          <Link href="/legal" className="hover:text-white hover:underline">
            Legal
          </Link>
        </p>
      </footer>
    </main>
  );
}
