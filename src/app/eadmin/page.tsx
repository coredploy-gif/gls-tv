import { BrowseNav } from "@/components/BrowseNav";
import { EadminSeedsPanel } from "@/components/EadminSeedsPanel";

export const metadata = {
  title: "Eadmin · Stream seeds",
  description: "Seed HLS stream URLs for GLS TV channels.",
};

export default function EadminPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <h1 className="gls-display text-5xl text-white">Eadmin</h1>
        <p className="mt-3 max-w-2xl text-sm text-gls-body">
          Seed stream URLs yourself. TSN 1–5 slots are pre-created — paste your
          HLS links and save. New slugs appear after you also add a catalog
          tile, or use an existing Sports slug.
        </p>
        <div className="mt-8">
          <EadminSeedsPanel />
        </div>
      </div>
    </main>
  );
}
