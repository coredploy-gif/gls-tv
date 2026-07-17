import { Suspense } from "react";
import { BrowseNav } from "@/components/BrowseNav";
import { TvPairConfirm } from "@/components/TvPairConfirm";

export const metadata = {
  title: "TV pairing",
  description: "Confirm sign-in for a GLS TV living-room device from your phone.",
};

export default function TvPairPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-lg px-4 sm:px-8">
        <h1 className="gls-display text-5xl text-white">TV pairing</h1>
        <p className="mt-3 text-sm text-[#c4c4d4]">
          Use this page on your phone to finish signing in on a TV.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-[#8e8ea0]">Loading…</p>}>
            <TvPairConfirm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
