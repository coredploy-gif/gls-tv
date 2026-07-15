"use client";

import { useState } from "react";
import { PublicContactForm } from "@/components/PublicContactForm";

export function AuthContactSection() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="mt-8 rounded-xl border border-white/12 bg-[#12121a] p-5">
      {!contactOpen ? (
        <>
          <p className="text-sm font-semibold text-white">
            New customer or need to reach GLS?
          </p>
          <p className="mt-1 text-xs text-[#a8a8b8]">
            Message us without signing in — we will get back to you as soon as
            possible.
          </p>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="mt-4 w-full rounded-lg border border-gls-pink/40 bg-gls-pink/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-gls-pink/25"
          >
            Message GLS
          </button>
        </>
      ) : (
        <PublicContactForm onClose={() => setContactOpen(false)} />
      )}
    </div>
  );
}
