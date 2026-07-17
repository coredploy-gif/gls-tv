"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  formatUserCodeDisplay,
  isValidUserCode,
  normalizeUserCode,
} from "@/lib/auth/tv-login";

export function TvPairConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signOut } = useAuth();
  const rawCode = searchParams.get("code") || "";
  const userCode = normalizeUserCode(rawCode);
  const valid = isValidUserCode(userCode);

  const [editedCode, setEditedCode] = useState<string | null>(null);
  const manualCode =
    editedCode ?? (rawCode ? formatUserCodeDisplay(rawCode) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const codeToUse = valid ? userCode : normalizeUserCode(manualCode);

  const approve = async () => {
    if (!isValidUserCode(codeToUse)) {
      setError("Enter the 8-character code shown on your TV (XXXX-XXXX).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/tv-login/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToUse }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not link this TV.");
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gls-muted">Checking your account…</p>;
  }

  if (done) {
    return (
      <div className="rounded-sm border border-emerald-500/30 bg-emerald-950/40 p-6 text-center">
        <h2 className="gls-display text-3xl text-white">TV linked</h2>
        <p className="mt-3 text-base text-emerald-100">
          You can return to your TV — it should sign in automatically. This page
          can be closed.
        </p>
        <Link
          href="/profiles"
          className="gls-cta mt-6 inline-block rounded px-6 py-3 text-sm font-semibold"
        >
          Continue on this phone
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <p className="mb-4 text-sm text-gls-body">
          Sign in on this phone, then confirm to link your TV.
        </p>
        {!valid && (
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gls-muted">
              Code from TV
            </span>
            <input
              value={manualCode}
              onChange={(e) => setEditedCode(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH"
              className="w-full rounded-sm border border-white/15 bg-black/50 px-4 py-3 font-mono text-lg tracking-widest text-white outline-none ring-gls-red focus:border-gls-red focus:ring-1"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        {valid && (
          <p className="mb-4 rounded bg-white/5 px-4 py-3 font-mono text-2xl tracking-[0.2em] text-white">
            {userCode}
          </p>
        )}
        <AuthPanel
          compact
          forceEmail
          onDone={() => {
            /* Stay on /auth/tv-pair — parent shows confirm once session exists. */
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6">
      <h2 className="gls-display text-3xl text-white">Link your TV?</h2>
      <p className="mt-2 text-sm text-gls-body">
        Signed in as{" "}
        <span className="text-white">{user.email || user.id}</span>. Confirm to
        sign this TV into the same account.
      </p>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gls-muted">
          Code from TV
        </span>
        <input
          value={manualCode}
          onChange={(e) => setEditedCode(e.target.value.toUpperCase())}
          placeholder="ABCD-EFGH"
          className="w-full rounded-sm border border-white/15 bg-black/50 px-4 py-3 font-mono text-2xl tracking-[0.2em] text-white outline-none ring-gls-red focus:border-gls-red focus:ring-1"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {error && (
        <p className="mt-4 rounded bg-gls-red/20 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void approve()}
        disabled={busy || !isValidUserCode(codeToUse)}
        className="gls-cta mt-5 w-full rounded py-3.5 text-base font-semibold disabled:opacity-50"
      >
        {busy ? "Linking…" : "Confirm — sign in on TV"}
      </button>
      <p className="mt-3 text-center text-xs text-gls-muted">
        Not you?{" "}
        <button
          type="button"
          className="underline hover:text-white"
          onClick={() => void signOut().then(() => router.refresh())}
        >
          Use a different account
        </button>
      </p>
    </div>
  );
}
