import { BrowseNav } from "@/components/BrowseNav";
import { PlaylistManager } from "@/components/PlaylistManager";

export const metadata = {
  title: "My Playlists",
  description:
    "Import your own M3U playlist link, save it to your GLS TV account, and watch in the custom layout.",
};

export default function PlaylistsPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        <PlaylistManager />
      </div>
    </main>
  );
}
