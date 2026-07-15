"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { GlsLogo } from "@/components/GlsLogo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getOrCreateDeviceId } from "@/lib/membership/device-client";

type Viewer = {
  id: string;
  name: string;
  avatar_id: string;
  is_kids: boolean;
  avatar_url?: string | null;
};

type Payload = {
  viewers: Viewer[];
  access: boolean;
  reason?: string;
  plan?: string;
  trialEndsAt?: string | null;
};

export function ProfilesGate() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?next=/profiles");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        const res = await fetch("/api/membership/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, action: "list" }),
        });
        const json = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError("We couldn’t load your profiles right now. Please sign in again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  const pickViewer = (p: Viewer) => {
    if (picking) return;
    setPicking(p.id);
    setError(null);
    startTransition(async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        const res = await fetch("/api/membership/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "select",
            viewerId: p.id,
            deviceId,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          redirectTo?: string;
          error?: string;
          code?: string;
          manageUrl?: string;
        };
        if (!res.ok || !json.redirectTo) {
          if (res.status === 409 || json.code === "DEVICE_LIMIT") {
            setPicking(null);
            setError(
              json.error ||
                "Sign out from a device already signed in, then try again.",
            );
            return;
          }
          throw new Error(json.error || "Could not open profile");
        }
        window.location.assign(json.redirectTo);
      } catch (e) {
        setPicking(null);
        setError(
          e instanceof Error
            ? e.message
            : "We couldn’t open that profile right now. Please try again.",
        );
      }
    });
  };

  if (loading || (!data && !error && user)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gls-black px-6">
        <GlsLogo size="lg" href="/" glass />
        <div className="gls-buffer-ring mt-16" aria-hidden />
        <p className="mt-6 text-sm text-gls-muted">Loading who’s watching…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gls-black px-6 text-center">
        <GlsLogo size="lg" href="/" glass />
        <p className="mt-10 text-white">{error}</p>
        <Link href="/auth" className="gls-cta mt-6 rounded px-5 py-2 text-sm">
          Sign in
        </Link>
      </main>
    );
  }

  if (data && !data.access) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gls-black px-6 text-center">
        <GlsLogo size="lg" href="/" glass />
        <h1 className="gls-display mt-12 text-4xl text-white">Trial locked</h1>
        <p className="mt-4 max-w-md text-sm text-gls-body">
          {data.reason ||
            "This device already used a free trial with another email."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/pricing" className="gls-cta rounded px-5 py-2 text-sm">
            View plans
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-white/30 px-5 py-2 text-sm text-gls-muted hover:text-white"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const viewers = data?.viewers || [];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gls-black px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,157,0.2),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(201,160,255,0.1),transparent_45%)]" />
      <GlsLogo size="lg" href="/" glass />
      <h1 className="gls-display relative mt-14 bg-gradient-to-b from-white to-gls-pink-soft/70 bg-clip-text text-4xl text-transparent sm:text-5xl">
        Who&apos;s watching?
      </h1>
      {data?.trialEndsAt && data.plan === "trial" && (
        <p className="relative mt-3 text-xs text-gls-muted">
          Free trial · ends{" "}
          {new Date(data.trialEndsAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
      {error && (
        <div className="relative z-10 mt-6 max-w-md rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-sm text-amber-100">{error}</p>
          <Link
            href="/account#devices"
            className="mt-2 inline-block text-sm font-semibold text-white underline"
          >
            Manage devices
          </Link>
        </div>
      )}
      <div className="relative z-10 mt-12 flex flex-wrap justify-center gap-8">
        {viewers.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={Boolean(picking) || pending}
            onClick={() => pickViewer(p)}
            className="group flex w-28 cursor-pointer flex-col items-center gap-3 disabled:opacity-60 sm:w-36"
          >
            <div className="gls-avatar-ring relative aspect-square w-full overflow-hidden rounded-md bg-gls-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  p.avatar_url ||
                  `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(p.avatar_id)}`
                }
                alt=""
                className="pointer-events-none h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              {picking === p.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="gls-buffer-ring !h-8 !w-8 border-2" />
                </div>
              )}
            </div>
            <span className="text-gls-muted transition group-hover:text-white">
              {p.name}
              {p.is_kids ? " · Kids" : ""}
            </span>
          </button>
        ))}
        <Link
          href="/profiles/manage"
          className="flex w-28 flex-col items-center gap-3 sm:w-36"
        >
          <div className="flex aspect-square w-full items-center justify-center rounded-md border-2 border-gls-muted/40 text-4xl text-gls-muted transition hover:border-white hover:text-white">
            +
          </div>
          <span className="text-gls-muted">Add Profile</span>
        </Link>
      </div>
      <div className="relative z-10 mt-16 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/profiles/manage"
          className="rounded border border-gls-muted/50 px-6 py-2 text-sm text-gls-muted transition hover:border-white hover:text-white"
        >
          Manage Profiles
        </Link>
        <Link
          href="/pricing"
          className="text-sm text-gls-muted transition hover:text-white"
        >
          Plans
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm text-gls-muted transition hover:text-white"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
