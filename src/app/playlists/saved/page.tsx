import { BrowseNav } from "@/components/BrowseNav";
import { SavedPlaylistsManager } from "@/components/SavedPlaylistsManager";

export const metadata = {
  title: "Saved Playlists",
  description:
    "Manage M3U playlists saved to your GLS TV account — re-sync, rename, replace, or remove.",
};

export default function SavedPlaylistsPage() {
  return (
    <main className="gls-below-nav min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        <SavedPlaylistsManager />
      </div>
    </main>
  );
}
