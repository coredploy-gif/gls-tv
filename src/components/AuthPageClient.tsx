"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { AuthContactSection } from "@/components/AuthContactSection";
import { useIsTvLikeDevice } from "@/lib/useIsTvLikeDevice";

export function AuthPageClient() {
  const tvLike = useIsTvLikeDevice();

  return (
    <>
      <h1 className="gls-display text-5xl text-white sm:text-6xl">
        {tvLike ? "TV sign in" : "Sign in"}
      </h1>
      <p className="mt-3 text-sm text-[#c4c4d4] sm:text-base">
        {tvLike ? (
          "Scan the QR code with your phone to sign in — then choose a profile and start watching."
        ) : (
          <>
            After you sign in, choose a profile and start watching. Manage M3U
            playlists anytime from{" "}
            <Link href="/playlists" className="text-white underline">
              My Playlists
            </Link>
            .
          </>
        )}
      </p>
      <div className="mt-8">
        <AuthPanel />
      </div>
      {!tvLike && <AuthContactSection />}
    </>
  );
}
