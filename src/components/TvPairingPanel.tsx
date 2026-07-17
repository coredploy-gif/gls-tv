"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TV_LOGIN_POLL_MS } from "@/lib/auth/tv-login";

type StartPayload = {
  userCode: string;
  deviceSecret: string;
  expiresAt: string;
  pairUrl: string;
  qrDataUrl: string;
  pollMs?: number;
};

const DEFAULT_POST_LOGIN_HREF = "/profiles";

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/** Large QR + short code for living-room / D-pad sign-in. */
export function TvPairingPanel({
  onUseEmail,
  onDone,
}: {
  onUseEmail: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<StartPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState("Starting secure pairing…");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const secretRef = useRef<string | null>(null);
  const finishingRef = useRef(false);

  const goAfterLogin = useCallback(() => {
    if (onDone) {
      onDone();
      return;
    }
    const next =
      safeNextPath(searchParams.get("next")) ?? DEFAULT_POST_LOGIN_HREF;
    router.replace(next);
  }, [onDone, router, searchParams]);

  const startPairing = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatusLine("Starting secure pairing…");
    finishingRef.current = false;
    try {
      const res = await fetch("/api/auth/tv-login/start", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await res.json()) as StartPayload & { error?: string };
      if (!res.ok) {
        setSession(null);
        secretRef.current = null;
        setError(data.error || "Could not start TV pairing.");
        setStatusLine("Pairing unavailable");
        return;
      }
      secretRef.current = data.deviceSecret;
      setSession(data);
      setRemaining(secondsLeft(data.expiresAt));
      setStatusLine("Waiting for your phone…");
    } catch {
      setError("Network error. Try again.");
      setStatusLine("Pairing unavailable");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void startPairing());
  }, [startPairing]);

  // Cancel only on real navigation away — not React Strict Mode remounts.
  useEffect(() => {
    const onPageHide = () => {
      const secret = secretRef.current;
      if (!secret || finishingRef.current) return;
      void fetch("/api/auth/tv-login/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) return;
    const tick = window.setInterval(() => {
      setRemaining(secondsLeft(session.expiresAt));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [session?.expiresAt]);

  useEffect(() => {
    if (!session?.deviceSecret) return;
    const pollMs = session.pollMs || TV_LOGIN_POLL_MS;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || finishingRef.current) return;
      try {
        const res = await fetch(
          `/api/auth/tv-login/status?secret=${encodeURIComponent(session.deviceSecret)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          status?: string;
          tokenHash?: string;
          email?: string;
          error?: string;
          message?: string;
        };
        if (cancelled) return;

        if (data.status === "pending") {
          setStatusLine("Waiting for your phone…");
          return;
        }
        if (data.status === "expired") {
          setError("This code expired. Generate a new one.");
          setStatusLine("Code expired");
          return;
        }
        if (data.status === "canceled" || data.status === "consumed") {
          setError(data.message || "Pairing ended. Generate a new code.");
          setStatusLine("Pairing ended");
          return;
        }
        if (data.status === "ready" && data.tokenHash) {
          finishingRef.current = true;
          setStatusLine("Signing you in…");
          const supabase = createClient();
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: data.tokenHash,
            type: "magiclink",
          });
          if (otpError) {
            // Fallback for projects that emit email-type hashes from generateLink.
            const retry = await supabase.auth.verifyOtp({
              token_hash: data.tokenHash,
              type: "email",
            });
            if (retry.error) {
              finishingRef.current = false;
              setError(
                retry.error.message ||
                  otpError.message ||
                  "Could not complete sign-in on this TV.",
              );
              setStatusLine("Sign-in failed");
              return;
            }
          }
          setStatusLine("Signed in — continuing…");
          goAfterLogin();
        }
      } catch {
        /* transient network — keep polling */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session?.deviceSecret, session?.pollMs, goAfterLogin]);

  const cancelAndRestart = async () => {
    const secret = secretRef.current;
    if (secret) {
      await fetch("/api/auth/tv-login/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      }).catch(() => undefined);
    }
    await startPairing();
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="rounded-sm border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6 sm:p-8">
      <h2 className="gls-display text-4xl text-white sm:text-5xl">Sign in with your phone</h2>
      <p className="mt-3 max-w-2xl text-base text-gls-body sm:text-lg">
        Scan the QR code or open{" "}
        <span className="text-white">gls-tv</span> on your phone and enter the
        code below. No typing on the TV remote.
      </p>

      <div className="mt-8 flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
        <div className="shrink-0 rounded-lg bg-white p-4 shadow-lg">
          {session?.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.qrDataUrl}
              alt="QR code to sign in on your phone"
              width={280}
              height={280}
              className="h-[240px] w-[240px] sm:h-[280px] sm:w-[280px]"
            />
          ) : (
            <div className="flex h-[240px] w-[240px] items-center justify-center bg-zinc-100 text-sm text-zinc-500 sm:h-[280px] sm:w-[280px]">
              {busy ? "Preparing…" : "—"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center lg:pt-4 lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gls-muted">
            TV code
          </p>
          <p
            className="mt-3 font-mono text-5xl font-bold tracking-[0.2em] text-white sm:text-6xl"
            aria-live="polite"
          >
            {session?.userCode || "————"}
          </p>
          <p className="mt-4 text-base text-gls-body" aria-live="polite">
            {statusLine}
          </p>
          {session && remaining > 0 && (
            <p className="mt-2 text-sm text-gls-muted">
              Code expires in {mins}:{secs.toString().padStart(2, "0")}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded bg-gls-red/20 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <button
              type="button"
              onClick={() => void cancelAndRestart()}
              disabled={busy}
              className="gls-cta rounded px-6 py-3 text-base font-semibold disabled:opacity-50"
            >
              New code
            </button>
            <button
              type="button"
              onClick={onUseEmail}
              className="gls-cta-ghost rounded px-6 py-3 text-base font-semibold"
            >
              Use email instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
