"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GlsLogo } from "@/components/GlsLogo";

function SuccessBody() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  const [status, setStatus] = useState<"syncing" | "ok" | "warn">("syncing");
  const [detail, setDetail] = useState("Confirming your plan…");

  useEffect(() => {
    if (!sessionId) {
      queueMicrotask(() => {
        setStatus("ok");
        setDetail("Payment received. Your plan will activate shortly.");
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setStatus("ok");
          setDetail(
            `Plan ${json.plan || "active"} is ready. Enjoy GLS TV.`,
          );
        } else {
          setStatus("warn");
          setDetail(
            json.error ||
              "Payment went through — activation may take a minute if webhooks are pending.",
          );
        }
      } catch {
        if (!cancelled) {
          setStatus("warn");
          setDetail(
            "Payment went through — refresh Who’s watching in a moment if plans don’t update.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gls-black px-6 text-center text-white">
      <GlsLogo size="md" href="/browse" glass />
      <h1 className="gls-display mt-10 text-5xl">
        {status === "syncing" ? "Almost there" : "You're in"}
      </h1>
      <p className="mt-3 max-w-md text-sm text-gls-muted">{detail}</p>
      {status === "syncing" && (
        <div className="gls-buffer-ring mt-8 !h-10 !w-10 border-2" />
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/profiles" className="gls-cta rounded-md px-6 py-3 text-sm">
          Who&apos;s watching
        </Link>
        <Link
          href="/browse"
          className="rounded-md border border-white/20 px-6 py-3 text-sm text-gls-body hover:text-white"
        >
          Browse
        </Link>
      </div>
    </main>
  );
}

export default function PricingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gls-black">
          <div className="gls-buffer-ring" />
        </main>
      }
    >
      <SuccessBody />
    </Suspense>
  );
}
