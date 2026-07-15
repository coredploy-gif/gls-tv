import Link from "next/link";
import { BrowseNav } from "@/components/BrowseNav";
import { GlsLogo } from "@/components/GlsLogo";

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24 text-gls-body">
      <BrowseNav />
      <article className="mx-auto max-w-3xl px-4 sm:px-8">
        <GlsLogo size="sm" href="/" />
        <h1 className="gls-display mt-8 text-5xl text-white">Legal</h1>
        <p className="mt-2 text-sm text-gls-muted">
          Media client utility · Last updated Jul 2026
        </p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed">
          <h2 className="text-xl font-semibold text-white">What GLS TV is</h2>
          <p>
            GLS TV is a <strong className="text-white">software utility</strong>{" "}
            — a high-performance media player, playlist manager, and live
            schedule aggregator. It helps you organise and play streams you are
            allowed to access.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-white">
            What GLS TV is not
          </h2>
          <p>
            GLS TV does <strong className="text-white">not</strong> host, store,
            rebroadcast, or claim ownership of TV channels, sports rights, movies,
            or series. We do not sell access to copyrighted premium broadcasts.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-white">
            Sources you may use
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Your own M3U / HLS playlists (bring your own)</li>
            <li>
              Community-maintained public Free-to-Air (FTA) and open indexes
            </li>
            <li>Public-domain and Creative Commons titles</li>
          </ul>

          <h2 className="pt-4 text-xl font-semibold text-white">
            Checkout / subscription framing
          </h2>
          <p className="rounded border border-white/15 bg-white/5 p-4 text-gls-body">
            This application is a software utility and media player aggregator.
            It does not host, stream, or own any media assets. Users can import
            custom assets or connect to community-maintained public Free-to-Air
            endpoints. Paid plans unlock reliability tooling (health-checked
            grids), schedule overlays, notifications, and advanced player
            features — not media rights.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-white">
            Account &amp; billing data
          </h2>
          <p>
            Register with <strong className="text-white">email + password</strong>{" "}
            for a 14-day trial. We also store viewer profile names/avatars you
            choose, and hashed device/IP tokens so one free trial cannot be
            endlessly reused on the same phone or network.
          </p>
          <p>
            Card details are collected later through{" "}
            <strong className="text-white">Stripe</strong> (PCI-compliant). We
            never store full card numbers or CVV on GLS servers — only Stripe
            customer/subscription ids. Debit follows your plan (R55 / R65 / R75)
            after you add a card.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-white">Your responsibility</h2>
          <p>
            You are responsible for ensuring any playlist or stream you import or
            play is lawful in your country. Broken or geo-blocked public feeds are
            outside our control.
          </p>
        </section>

        <Link
          href="/"
          className="mt-12 inline-block text-sm text-gls-red hover:underline"
        >
          ← Back home
        </Link>
      </article>
    </main>
  );
}
