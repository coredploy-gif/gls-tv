import Link from "next/link";
import { BrowseNav } from "@/components/BrowseNav";
import { GlsLogo } from "@/components/GlsLogo";

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-20 pt-24 text-gls-body">
      <BrowseNav />
      <article className="mx-auto max-w-3xl px-4 sm:px-8">
        <GlsLogo size="sm" href="/" />
        <h1 className="gls-display mt-8 text-5xl text-white">Policies</h1>
        <p className="mt-2 text-sm text-gls-muted">
          Version 1.0 · Effective 15 July 2026
        </p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed">
          <h2 id="terms" className="text-xl font-semibold text-white">
            Terms of Service
          </h2>
          <p>
            GLS TV is a <strong className="text-white">software utility</strong>{" "}
            — a high-performance media player, playlist manager, and live
            schedule aggregator. It helps you organise and play streams you are
            allowed to access. You must be legally able to enter this agreement
            or use the service with a parent or guardian.
          </p>
          <p>
            GLS TV does <strong className="text-white">not</strong> host, store,
            rebroadcast, or claim ownership of TV channels, sports rights, movies,
            or series. Availability can change and is not guaranteed. We may
            suspend accounts used unlawfully, abusively, or to evade access
            controls.
          </p>
          <p>
            The free trial lasts up to 14 days and is limited using account,
            device and network signals. Paid access is sold in 30-day periods.
            There is no automatic debit: you choose whether to renew.
          </p>

          <h2 id="privacy" className="pt-4 text-xl font-semibold text-white">
            Privacy and POPIA notice
          </h2>
          <p>
            We process account email and authentication data through Supabase;
            hosting, request logs and deployment data through Vercel; Yoco
            payment-link identifiers and statuses; EFT references and proof
            notes; viewer names and avatars; support messages; receipts; and
            hashed device/IP signals used for trial abuse prevention. Raw IP
            addresses may appear temporarily in infrastructure security logs.
          </p>
          <p>
            We use this information to provide and secure the service, verify
            payments, answer support requests, prevent fraud and keep required
            business records. We do not sell personal information. Access is
            limited to operators and providers that need it. Retention depends
            on account, security, support and legal-record needs; deletion or
            correction requests can be submitted through the published support
            contact, subject to records we must retain.
          </p>
          <p>
            GLS TV stores a device identifier and viewer preference in browser
            local storage/cookies. Authentication cookies and the active-viewer
            cookie are used to keep you signed in and select a profile.
          </p>

          <h2 id="payments" className="pt-4 text-xl font-semibold text-white">
            Payments, cancellation and refunds
          </h2>
          <p>
            Plans cost R55, R65 or R75 for 30 days. Payment is made manually
            using a Yoco payment link or EFT with the exact GLS reference.
            Access starts only after verification. GLS TV does not automatically
            debit cards or bank accounts.
          </p>
          <p>
            You can stop using the service at any time by not renewing. To ask
            for a refund, contact support with the payment reference and reason.
            Eligibility is assessed under applicable law and the circumstances
            of the request. Approved refunds are returned externally through
            Yoco or EFT; a GLS TV status change alone does not move money. Timing
            depends on the payment provider and bank.
          </p>

          <h2 id="acceptable-use" className="pt-4 text-xl font-semibold text-white">
            Acceptable Use
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Only import playlists and streams you are authorised to access.</li>
            <li>
              Do not probe private networks, bypass geographic or technical
              restrictions, share accounts beyond plan limits, scrape the
              service, overload proxies, or upload malicious content.
            </li>
            <li>Do not use GLS TV to infringe copyright or other rights.</li>
          </ul>

          <h2 id="copyright" className="pt-4 text-xl font-semibold text-white">
            Copyright and takedown
          </h2>
          <p>
            Rights holders may send a notice through the published support
            contact identifying the work, disputed source, basis of the claim,
            contact details and a good-faith statement. We may disable a source
            while reviewing a sufficiently detailed notice. False or abusive
            notices may be rejected.
          </p>

          <h2 id="children" className="pt-4 text-xl font-semibold text-white">
            Kids profiles and consent
          </h2>
          <p>
            A kids profile is a viewing preference, not a separate child
            account or a guarantee that every external source is suitable.
            The account holder is responsible for supervision, profile names
            and imported sources. A parent or guardian must provide any consent
            required for a child’s use.
          </p>

          <h2 id="contact" className="pt-4 text-xl font-semibold text-white">
            Contact and policy changes
          </h2>
          <p>
            Use the monitored support address published in GLS TV for privacy,
            refund, support and takedown requests. The operator’s final legal
            identity, address and response-time commitment must be published
            before public launch. Material policy changes will receive a new
            version/effective date; continued use may require renewed consent.
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
