import { BrowseNav } from "@/components/BrowseNav";
import { MediaLibrary } from "@/components/MediaLibrary";

export const metadata = {
  title: "My Links",
  description:
    "Save and play HLS streams, YouTube, Vimeo, MP4, and WebM links in your GLS library.",
};

export default function LibraryPage() {
  return (
    <main className="gls-below-nav min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        <MediaLibrary />
      </div>
    </main>
  );
}
