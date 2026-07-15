import { Suspense } from "react";
import { BrowseNav } from "@/components/BrowseNav";
import { AuthPanel } from "@/components/AuthPanel";
import { AuthContactSection } from "@/components/AuthContactSection";
import Link from "next/link";

export const metadata = {
  title: "Sign in",
  description: "Sign in to save M3U playlists to your GLS TV account.",
};

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-lg px-4 sm:px-8">
        <h1 className="gls-display text-5xl text-white">Sign in</h1>
        <p className="mt-3 text-sm text-[#c4c4d4]">
          After you sign in, choose a profile and start watching. Manage M3U
          playlists anytime from{" "}
          <Link href="/playlists" className="text-white underline">
            My Playlists
          </Link>
          .
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-[#8e8ea0]">Loading…</p>}>
            <AuthPanel />
          </Suspense>
        </div>
        <AuthContactSection />
      </div>
    </main>
  );
}
