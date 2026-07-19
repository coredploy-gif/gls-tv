"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { safeNextPath } from "@/lib/auth/safe-next";
import { useAppCopy } from "@/lib/useAppCopy";
import { TvPairingPanel } from "@/components/TvPairingPanel";
import { useIsTvLikeDevice } from "@/lib/useIsTvLikeDevice";
import {
  pathNeedsViewer,
  profilesGateHref,
} from "@/lib/membership/access-paths";

type Mode = "signin" | "signup";

const DEFAULT_POST_LOGIN_HREF = "/profiles";

function PasswordField({
  mode,
  password,
  setPassword,
}: {
  mode: Mode;
  password: string;
  setPassword: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gls-muted">
        Password
      </span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="w-full rounded-sm border border-white/15 bg-black/50 px-4 py-3 pr-24 text-white outline-none ring-gls-red placeholder:text-white/30 focus:border-gls-red focus:ring-1"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-gls-muted hover:text-white"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function oauthErrorMessage(
  raw: string,
  copy: (key: string) => string,
): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider") ||
    lower.includes("validation_failed") ||
    lower.includes("not enabled")
  ) {
    return copy("auth.error.oauth_unavailable");
  }
  return copy("auth.error.oauth_failed");
}

export function AuthPanel({
  onDone,
  compact = false,
  /** Phone pairing / embedded flows must never show TV QR as primary. */
  forceEmail = false,
  onBusyChange,
}: {
  onDone?: () => void;
  compact?: boolean;
  forceEmail?: boolean;
  /** Lets /auth hide Message GLS while redirecting or starting OAuth. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const searchParams = useSearchParams();
  const {
    signInWithPassword,
    signUpWithPassword,
    signInWithOAuth,
    user,
    loading,
    signOut,
  } = useAuth();
  const copy = useAppCopy();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [signupsAllowed, setSignupsAllowed] = useState(true);
  const [signupFreezeMsg, setSignupFreezeMsg] = useState<string | null>(null);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [preferEmailOnTv, setPreferEmailOnTv] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const hardNavLock = useRef(false);
  const tvOverride = searchParams.get("tv") === "1";
  const isTv = useIsTvLikeDevice(tvOverride) && !forceEmail;

  const postLoginHref = (() => {
    const intended = safeNextPath(
      searchParams.get("next"),
      DEFAULT_POST_LOGIN_HREF,
    );
    // Fresh logins never have a viewer cookie yet — go through Who's watching
    // and return to the intended page (e.g. My Playlists) after pick.
    if (pathNeedsViewer(intended.split("?")[0] || intended)) {
      return profilesGateHref(intended);
    }
    return intended;
  })();

  useEffect(() => {
    onBusyChange?.(redirecting || busy);
  }, [redirecting, busy, onBusyChange]);

  useEffect(() => {
    void fetch("/api/auth/signup-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setSignupsAllowed(data.allowed !== false);
        setSignupFreezeMsg(data.message || null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch("/api/auth/oauth-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { google?: boolean }) => {
        setGoogleOAuthEnabled(data.google === true);
      })
      .catch(() => {
        setGoogleOAuthEnabled(false);
      });
  }, []);

  const goAfterLogin = useCallback(() => {
    if (onDone) {
      onDone();
      return;
    }
    if (hardNavLock.current) return;
    hardNavLock.current = true;
    setRedirecting(true);
    // Hard navigation is faster/more reliable than soft router.replace right
    // after auth cookies settle — avoids lingering on /auth with Message GLS.
    window.location.assign(postLoginHref);
  }, [onDone, postLoginHref]);

  // Already signed in (refresh / back) → leave /auth immediately.
  // Spinner comes from `(user && !onDone)` — no setState here (lint + hang fix).
  useEffect(() => {
    if (loading || !user || onDone || hardNavLock.current) return;
    hardNavLock.current = true;
    window.location.assign(postLoginHref);
  }, [loading, user, onDone, postLoginHref]);

  const oauthNext = useCallback(() => {
    if (onDone && typeof window !== "undefined") {
      return safeNextPath(
        `${window.location.pathname}${window.location.search}`,
        "/auth/tv-pair",
      );
    }
    return postLoginHref;
  }, [onDone, postLoginHref]);

  const startGoogleOAuth = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    setRedirecting(true);
    const err = await signInWithOAuth("google", { next: oauthNext() });
    if (err) {
      setBusy(false);
      setRedirecting(false);
      setError(oauthErrorMessage(err, copy));
    }
    // On success Supabase navigates away to the provider.
  };

  if (loading || redirecting || (user && !onDone)) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 py-8 ${compact ? "" : "rounded-sm border border-white/10 bg-white/[0.03] p-6"}`}
      >
        <div className="gls-buffer-ring" aria-hidden />
        <p className="text-sm font-medium text-white">
          {user
            ? "Taking you to who’s watching…"
            : busy
              ? "Continuing…"
              : "Checking your account…"}
        </p>
        <p className="text-xs text-gls-muted">Almost there — this only takes a moment.</p>
      </div>
    );
  }

  if (user && onDone) {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 ${compact ? "" : "rounded-sm border border-white/10 bg-white/[0.03] p-4"}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Signed in</p>
          <p className="truncate text-sm text-gls-body">
            {user.email || user.id}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (isTv && !preferEmailOnTv) {
    return (
      <TvPairingPanel
        onDone={onDone}
        onUseEmail={() => setPreferEmailOnTv(true)}
      />
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === "signup") {
      if (!signupsAllowed) {
        setBusy(false);
        setError(signupFreezeMsg || copy("auth.error.signups_paused"));
        return;
      }
      const status = await fetch("/api/auth/signup-status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ allowed: true }));
      if (status.allowed === false) {
        setBusy(false);
        setError(status.message || copy("auth.error.signups_paused"));
        return;
      }
    }

    const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const err = await action(email, password);
    if (err) {
      setBusy(false);
      const lower = err.toLowerCase();
      if (lower.includes("leak") || lower.includes("pwned") || lower.includes("breach")) {
        setError(copy("auth.error.breached_password"));
      } else if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
        setError(copy("auth.error.invalid_credentials"));
      } else {
        setError(err);
      }
      return;
    }
    if (mode === "signup") {
      setBusy(false);
      setInfo(copy("auth.info.verify_email"));
      setMode("signin");
      return;
    }
    // Keep busy/redirecting UI — do not flash the email form again.
    goAfterLogin();
  };

  return (
    <div
      className={
        compact
          ? ""
          : "rounded-sm border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5 sm:p-6"
      }
    >
      {!compact && (
        <>
          <h2 className="gls-display text-3xl text-white">Account</h2>
          <p className="mt-2 max-w-xl text-sm text-gls-body">
            {googleOAuthEnabled
              ? "Continue with Google or use email. After sign-in, choose who’s watching — then Home."
              : "Sign in with email. After sign-in, choose who’s watching — then Home."}
          </p>
        </>
      )}

      {googleOAuthEnabled && (
        <>
          <div className={`${compact ? "" : "mt-5"} space-y-3`}>
            <button
              type="button"
              onClick={() => void startGoogleOAuth()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-sm border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
              aria-label="Continue with Google"
            >
              <GoogleIcon className="h-5 w-5 shrink-0" />
              Continue with Google
            </button>
          </div>

          <div
            className="my-5 flex items-center gap-3"
            role="separator"
            aria-label="or continue with email"
          >
            <div className="h-px flex-1 bg-white/15" />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-gls-muted">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-white/15" />
          </div>
        </>
      )}

      <div className={`flex gap-2 ${!googleOAuthEnabled && !compact ? "mt-5" : ""}`}>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${
            mode === "signin"
              ? "bg-white text-black"
              : "bg-white/10 text-gls-body hover:bg-white/15"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          disabled={!signupsAllowed}
          className={`rounded px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
            mode === "signup"
              ? "bg-white text-black"
              : "bg-white/10 text-gls-body hover:bg-white/15"
          }`}
        >
          Create account
        </button>
      </div>

      {!signupsAllowed && (
        <p className="mt-3 rounded bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          {signupFreezeMsg || "New registrations are temporarily paused."}
        </p>
      )}

      {error && (
        <p
          className="mt-3 rounded bg-gls-red/20 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gls-muted">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-sm border border-white/15 bg-black/50 px-4 py-3 text-white outline-none ring-gls-red placeholder:text-white/30 focus:border-gls-red focus:ring-1"
          />
        </label>
        {mode === "signup" && (
          <label className="flex items-start gap-2 text-xs leading-relaxed text-gls-body">
            <input
              type="checkbox"
              required
              checked={acceptedPolicies}
              onChange={(event) => setAcceptedPolicies(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{" "}
              <Link href="/legal#terms" className="text-white underline">
                Terms
              </Link>
              ,{" "}
              <Link href="/legal#privacy" className="text-white underline">
                Privacy/POPIA notice
              </Link>
              , trial/device rules and kids-profile terms.
            </span>
          </label>
        )}
        <PasswordField mode={mode} password={password} setPassword={setPassword} />
        {info && (
          <p className="rounded bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">
            {info}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || (mode === "signup" && (!acceptedPolicies || !signupsAllowed))}
          className="gls-cta mt-1 w-full rounded py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
        {mode === "signin" && (
          <p className="text-center text-xs text-gls-muted">
            <Link href="/auth/reset" className="underline hover:text-white">
              Forgot password?
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
