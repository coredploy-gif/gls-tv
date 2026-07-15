"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { GlsPlanId } from "@/lib/membership/plans";

export function PricingCheckoutButton({
  planId,
  label = "Subscribe",
  className = "gls-cta mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm",
}: {
  planId: GlsPlanId;
  label?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setErr(null);
    if (!user) {
      window.location.assign(`/auth?mode=signup&next=${encodeURIComponent("/pricing")}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/billing/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          plan: planId,
          paymentMethod: "unselected",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setErr(
          json.error ||
            "We can’t prepare payment right now. Please try again shortly.",
        );
        setBusy(false);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setErr("We can’t connect right now. Please try again shortly.");
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" disabled={busy} onClick={go} className={className}>
        {busy ? "Preparing payment…" : user ? label : "Sign in to subscribe"}
      </button>
      {err && <p className="mt-2 text-xs text-gls-red">{err}</p>}
    </div>
  );
}
