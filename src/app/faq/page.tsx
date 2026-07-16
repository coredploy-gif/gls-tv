import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrowseNav } from "@/components/BrowseNav";
import { GlsLogo } from "@/components/GlsLogo";

export const metadata: Metadata = {
  title: "FAQ · GLS TV",
  description:
    "Answers about GLS TV membership, streaming, region availability, VPNs, My Links, playlists, payments, and kids profiles.",
  alternates: { canonical: "/faq" },
};

type Qa = { id: string; q: string; a: ReactNode };

const SECTIONS: { id: string; title: string; items: Qa[] }[] = [
  {
    id: "basics",
    title: "Basics",
    items: [
      {
        id: "what-is-gls",
        q: "What is GLS TV?",
        a: (
          <>
            GLS TV is a membership media player and organiser. It helps you
            browse curated live and on-demand titles, manage private playlists,
            and save playable personal links — all in one place. GLS does{" "}
            <strong className="text-white">not</strong> host or claim ownership
            of TV networks, sports rights, or studio catalogues.
          </>
        ),
      },
      {
        id: "who-can-use",
        q: "Who can use GLS TV?",
        a: (
          <>
            Anyone who can legally agree to our{" "}
            <Link href="/legal#terms" className="text-white underline">
              Terms
            </Link>
            . A parent or guardian must supervise kids profiles and provide any
            consent required for a child’s use.
          </>
        ),
      },
      {
        id: "trial",
        q: "Is there a free trial?",
        a: (
          <>
            Yes — up to 14 days for new accounts, limited with account, device,
            and network signals (one trial per device). After that, choose a
            30-day plan on{" "}
            <Link href="/pricing" className="text-white underline">
              Plans
            </Link>
            .
          </>
        ),
      },
    ],
  },
  {
    id: "region-vpn",
    title: "Regions & VPN",
    items: [
      {
        id: "why-no-vpn",
        q: "Why doesn’t GLS include a VPN?",
        a: (
          <>
            <p className="mb-3">
              GLS is <strong className="text-white">local-first streaming</strong>
              , not a geo-bypass tool. We do not sell, bundle, or operate a VPN
              to pretend you are in another country.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Many streams are limited by the source owner or CDN to certain
                networks and territories.
              </li>
              <li>
                Building a VPN to dodge those limits would look like intentional
                circumvention — bad for members, partners, and the law.
              </li>
              <li>
                VPNs also add lag and buffering, and many CDNs block datacentre
                VPN IPs anyway.
              </li>
            </ul>
            <p className="mt-3">
              Instead we prefer working mirrors for your connection when we can,
              and we keep licensed catalogue titles separate from personal or
              staff links.
            </p>
          </>
        ),
      },
      {
        id: "channel-wont-play",
        q: "A channel says it isn’t available on my network. What now?",
        a: (
          <>
            That usually means the upstream stream is region-locked, offline, or
            blocking your ISP. Try another channel, wait for health checks to
            rotate mirrors, or use the official app for that title in your
            territory. GLS support cannot unlock geo-blocked feeds with a VPN.
          </>
        ),
      },
      {
        id: "can-i-use-my-vpn",
        q: "Can I use my own VPN with GLS?",
        a: (
          <>
            You may use a third-party VPN on your device if you choose. GLS does
            not provide or support that setup, and we cannot guarantee playback
            behind VPN exits — many streams will still fail. Using a VPN does
            not change our Terms: only access streams you are authorised to
            watch.
          </>
        ),
      },
      {
        id: "local-first",
        q: "What does “local-first” mean?",
        a: (
          <>
            We order and heal sources so that feeds more likely to work in your
            region (for example South Africa / Africa mirrors) are tried first.
            That is failover — not spoofing your location.
          </>
        ),
      },
    ],
  },
  {
    id: "watching",
    title: "Watching",
    items: [
      {
        id: "profiles",
        q: "What are profiles?",
        a: (
          <>
            After sign-in you pick who’s watching. Adult and Kids profiles keep
            continue watching, My List, and last channel separate. Device limits
            apply per plan.
          </>
        ),
      },
      {
        id: "buffering",
        q: "Why does a live stream buffer or switch sources?",
        a: (
          <>
            Live HLS depends on the upstream CDN. GLS retries and can advance
            to the next mirror automatically. Brief stalls are normal on busy
            networks; if a title stays dead, Daily Ops health checks may demote
            it until a better source returns.
          </>
        ),
      },
      {
        id: "epg",
        q: "What is “What’s on”?",
        a: (
          <>
            Some live channels show a Now / Next programme strip when schedule
            data is available. It is a lightweight guide — not a full TV guide
            for every channel yet.
          </>
        ),
      },
      {
        id: "offline",
        q: "Does GLS work offline?",
        a: (
          <>
            The app shell can open offline (PWA), but live streams, My Links
            playback, account changes, and payments need a connection. Streams
            are never cached on purpose.
          </>
        ),
      },
    ],
  },
  {
    id: "library",
    title: "My Playlists & My Links",
    items: [
      {
        id: "playlists-vs-links",
        q: "What’s the difference between My Playlists and My Links?",
        a: (
          <>
            <strong className="text-white">My Playlists</strong> is for M3U
            channel lists and single .m3u8 streams.{" "}
            <strong className="text-white">My Links</strong> is for
            guaranteed-playable personal URLs: HLS, YouTube, Vimeo, MP4, and
            WebM, organised into folders like Movies, Sports, and News. Neither
            is part of the licensed GLS catalogue.
          </>
        ),
      },
      {
        id: "user-responsibility",
        q: "Who is responsible for links I add?",
        a: (
          <>
            You are. Only import media you have the right to watch. User-added
            content stays in your private library and is not GLS-owned
            programming. See the disclaimer on My Links and our{" "}
            <Link href="/legal#acceptable-use" className="text-white underline">
              Acceptable Use
            </Link>{" "}
            rules.
          </>
        ),
      },
      {
        id: "staff-picks",
        q: "What are Staff picks?",
        a: (
          <>
            Curated playable links published by GLS admins after preview and
            confirm. They appear on My Links as Staff picks — still separate
            from the licensed catalogue. Use Report if something looks wrong.
          </>
        ),
      },
      {
        id: "report-link",
        q: "How do I report a bad or infringing link?",
        a: (
          <>
            On My Links or Staff picks, use <strong className="text-white">Report</strong>.
            Rights holders can also follow the{" "}
            <Link href="/legal#copyright" className="text-white underline">
              copyright / takedown
            </Link>{" "}
            process. Our team reviews open reports in admin.
          </>
        ),
      },
    ],
  },
  {
    id: "billing",
    title: "Membership & payments",
    items: [
      {
        id: "how-pay",
        q: "How do I pay?",
        a: (
          <>
            Choose a plan, then pay with a Yoco payment link/QR or EFT using the
            exact GLS reference. Access starts after verification. There is{" "}
            <strong className="text-white">no automatic debit</strong> — you
            renew each 30 days if you want to continue. Details:{" "}
            <Link href="/legal#payments" className="text-white underline">
              Payments policy
            </Link>
            .
          </>
        ),
      },
      {
        id: "refunds",
        q: "Can I get a refund?",
        a: (
          <>
            Contact support with your payment reference and reason. Approved
            refunds go through Yoco or EFT externally — a status change in GLS
            alone does not move money.
          </>
        ),
      },
      {
        id: "devices",
        q: "How many devices can watch at once?",
        a: (
          <>
            Concurrent device sessions depend on your plan (adult limits plus a
            Kids profile where included). Manage or revoke devices from Account.
            Sharing beyond plan limits can trigger blocks.
          </>
        ),
      },
    ],
  },
  {
    id: "account",
    title: "Account & privacy",
    items: [
      {
        id: "password",
        q: "I can’t tell if I typed my password correctly.",
        a: (
          <>
            On Sign in / Create account, use <strong className="text-white">Show</strong>{" "}
            next to the password field to reveal what you typed, then Hide again
            when done.
          </>
        ),
      },
      {
        id: "privacy",
        q: "What data do you collect?",
        a: (
          <>
            Account email, auth session, viewer profiles, payment references,
            support messages, and security signals needed to run the service.
            See the{" "}
            <Link href="/legal#privacy" className="text-white underline">
              Privacy / POPIA notice
            </Link>
            .
          </>
        ),
      },
      {
        id: "signups-paused",
        q: "Create account is disabled. Why?",
        a: (
          <>
            New registrations can be paused during maintenance or abuse spikes.
            Try again later or contact support if you already paid.
          </>
        ),
      },
    ],
  },
  {
    id: "support",
    title: "Help",
    items: [
      {
        id: "contact",
        q: "How do I contact support?",
        a: (
          <>
            Signed-in members can open{" "}
            <Link href="/support" className="text-white underline">
              Support
            </Link>{" "}
            or use the in-app chat widget. Include your member/payment reference
            for billing issues.
          </>
        ),
      },
      {
        id: "more-policies",
        q: "Where are the full legal policies?",
        a: (
          <>
            Everything binding is on{" "}
            <Link href="/legal" className="text-white underline">
              Policies
            </Link>
            . This FAQ explains common questions in plain language; if anything
            conflicts, the Policies page wins.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-24 text-gls-body">
      <BrowseNav />
      <article className="mx-auto max-w-3xl px-4 sm:px-8">
        <GlsLogo size="sm" href="/" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-gls-red">
          Help centre
        </p>
        <h1 className="gls-display mt-2 text-5xl text-white sm:text-6xl">FAQ</h1>
        <p className="mt-3 max-w-2xl text-base text-gls-body">
          Straight answers about membership, playback, regions, and why GLS
          doesn’t ship a VPN. Local-first streaming — not geo-bypass.
        </p>

        <nav
          aria-label="FAQ sections"
          className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-6"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-gls-muted hover:border-white/40 hover:text-white"
            >
              {section.title}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-12">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
              <div className="mt-5 space-y-4">
                {section.items.map((item) => (
                  <details
                    key={item.id}
                    id={item.id}
                    className="group rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 open:border-white/20"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start justify-between gap-3">
                        {item.q}
                        <span className="shrink-0 text-gls-muted group-open:rotate-45">
                          +
                        </span>
                      </span>
                    </summary>
                    <div className="mt-3 text-sm leading-relaxed text-gls-body">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="mt-14 rounded-xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-50">
          <p className="font-semibold text-white">Region reminder</p>
          <p className="mt-2 text-amber-50/90">
            If a stream is blocked on your network, GLS will not provide a VPN
            to get around it. Try another title, or the official service for
            that content in your country.
          </p>
        </aside>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/legal" className="text-gls-red hover:underline">
            Full policies
          </Link>
          <Link href="/pricing" className="text-gls-muted hover:text-white hover:underline">
            Plans
          </Link>
          <Link href="/support" className="text-gls-muted hover:text-white hover:underline">
            Support
          </Link>
          <Link href="/" className="text-gls-muted hover:text-white hover:underline">
            ← Home
          </Link>
        </div>
      </article>
    </main>
  );
}
