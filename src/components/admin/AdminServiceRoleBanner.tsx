"use client";

import { useEffect, useState } from "react";

/** Shows when SUPABASE_SERVICE_ROLE_KEY is missing — Finance/Ops need it. */
export function AdminServiceRoleBanner() {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/health");
        const json = await res.json();
        if (!cancelled && res.ok && !json.ok) {
          setHint(json.hint || "Server env incomplete");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hint) return null;

  return (
    <div
      className="mx-3 mt-3 rounded-lg border border-gls-red/40 bg-gls-red/15 px-3 py-2.5 text-sm text-red-100 sm:mx-6 sm:mt-4 sm:px-4 sm:py-3 lg:mx-10"
      role="alert"
    >
      <p className="font-semibold">Admin APIs blocked — no service role</p>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{hint}</p>
      <p className="mt-2 text-[11px] text-red-200/80">
        Dashboard path: Supabase → Project Settings → API →{" "}
        <span className="font-mono">service_role</span> (secret) → paste into{" "}
        <span className="font-mono">.env.local</span> as{" "}
        <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY=…</span> → restart{" "}
        <span className="font-mono">npm run dev</span>.
      </p>
    </div>
  );
}
