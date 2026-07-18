import Link from "next/link";
import { GlsLogo } from "@/components/GlsLogo";
import { PricingCheckoutButton } from "@/components/PricingCheckoutButton";
import { GLS_PLANS } from "@/lib/membership/plans";

type Props = {
  searchParams?: Promise<{ canceled?: string }> | { canceled?: string };
};

export default async function PricingPage({ searchParams }: Props) {
  const sp = searchParams
    ? await Promise.resolve(searchParams)
    : ({} as { canceled?: string });
  const canceled = sp.canceled === "1";

  return (
    <main className="min-h-screen bg-gls-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <GlsLogo size="md" href="/" glass />
          <Link href="/auth" className="gls-cta rounded-md px-4 py-1.5 text-sm">
            Sign In
          </Link>
        </header>
        <div className="mt-14 max-w-3xl">
          <p className="gls-eyebrow">Simple membership</p>
          <h1 className="gls-display mt-3 text-5xl sm:text-6xl">Plans made for your household</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gls-body">
            Start with 14 days on us, then continue with a simple membership.
            Pay securely with PayFast (card debit) or use EFT with your unique
            GLS reference. Every plan includes a dedicated Kids profile.
          </p>
        </div>
        {canceled && (
          <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            Payment canceled — pick a plan when you&apos;re ready.
          </p>
        )}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {GLS_PLANS.map((p, i) => (
            <div
              key={p.id}
              className={`gls-glass gls-card-lift relative rounded-2xl p-6 ${p.id === "gls_65" ? "border-gls-pink/50 shadow-[0_18px_50px_rgba(232,32,58,0.16)]" : "border-white/10"}`}
            >
              {p.id === "gls_65" && (
                <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-gls-red to-gls-pink px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-lg">
                  Most popular
                </span>
              )}
              <p
                className="text-xs font-bold uppercase tracking-[0.25em]"
                style={{
                  color: p.id === "gls_65" ? "#ffffff" : "#d4d4d4",
                }}
              >
                {p.name}
              </p>
              <p className="mt-3 text-4xl font-semibold">
                R{p.priceZar}
                <span className="text-base font-normal text-gls-muted">/30 days</span>
              </p>
              <ul className="mt-5 space-y-3 text-sm text-gls-body">
                <li className="flex gap-2"><span className="text-gls-mint">✓</span>{p.adultProfiles} adult profiles</li>
                <li className="flex gap-2"><span className="text-gls-mint">✓</span>Dedicated Kids profile</li>
                <li className="flex gap-2"><span className="text-gls-mint">✓</span>Playlists and continue watching</li>
                <li className="flex gap-2"><span className="text-gls-mint">✓</span>PayFast or EFT in ZAR</li>
              </ul>
              <PricingCheckoutButton
                planId={p.id}
                label={`Choose R${p.priceZar}`}
              />
              <Link
                href="/auth?mode=signup"
                className="mt-3 block text-center text-xs text-gls-muted hover:text-gls-pink-soft"
              >
                Or start free trial
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-3 border-t border-white/10 pt-6 text-sm text-gls-muted sm:grid-cols-3">
          <p><span className="font-semibold text-white">14-day trial</span><br />Try GLS TV before you pay.</p>
          <p><span className="font-semibold text-white">PayFast debit</span><br />Card debit on the day you choose, or pay by EFT.</p>
          <p><span className="font-semibold text-white">Simple local payment</span><br />PayFast checkout or verified EFT.</p>
        </div>
      </div>
    </main>
  );
}
