import { Suspense } from "react";
import { BrowseNav } from "@/components/BrowseNav";
import { AuthPageClient } from "@/components/AuthPageClient";

export const metadata = {
  title: "Sign in",
  description: "Sign in to save M3U playlists to your GLS TV account.",
};

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-lg px-4 sm:max-w-3xl sm:px-8">
        <Suspense fallback={<p className="text-sm text-[#8e8ea0]">Loading…</p>}>
          <AuthPageClient />
        </Suspense>
      </div>
    </main>
  );
}
