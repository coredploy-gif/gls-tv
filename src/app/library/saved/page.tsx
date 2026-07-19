import { BrowseNav } from "@/components/BrowseNav";
import { SavedLinksManager } from "@/components/SavedLinksManager";

export const metadata = {
  title: "Saved Links",
  description:
    "Manage HLS, YouTube, Vimeo, MP4, and WebM links saved to your GLS TV account.",
};

export default function SavedLinksPage() {
  return (
    <main className="gls-below-nav min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        <SavedLinksManager />
      </div>
    </main>
  );
}
