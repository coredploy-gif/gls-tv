import { BrowseNav } from "@/components/BrowseNav";
import { GamesHub } from "@/components/GamesHub";

export const metadata = {
  title: "Games · GLS TV",
  description:
    "Free HTML5 games on GLS TV — search, phone-friendly touch pads for Snake and Brick Stack, and community leaderboards.",
};

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <GamesHub />
    </main>
  );
}
