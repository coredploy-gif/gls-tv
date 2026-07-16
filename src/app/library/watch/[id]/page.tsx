import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchBackButton } from "@/components/WatchBackButton";
import type { CatalogItem } from "@/data/types";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";
import type { MediaLinkFormat, UserMediaLink } from "@/lib/media-links";

type Props = { params: Promise<{ id: string }> };

function toCatalog(link: UserMediaLink): CatalogItem {
  const format =
    link.format === "mp4" || link.format === "webm" ? "mp4" : "hls";
  return {
    id: `media-${link.id}`,
    slug: `media-${link.id}`,
    title: link.title,
    type: link.format === "hls" ? "live" : "movie",
    description: `${link.format.toUpperCase()} · My Links`,
    countries: ["world"],
    categories: ["My Links", link.category, "Playable"],
    languages: ["English"],
    poster:
      link.thumbnail_url ||
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&h=2400&q=80",
    backdrop:
      link.thumbnail_url ||
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=3840&h=2160&q=80",
    license: "open_stream",
    isLive: link.format === "hls",
    featured: false,
    sources: [
      {
        url: link.url,
        quality: "Auto",
        format: format as "hls" | "mp4",
      },
    ],
  };
}

function EmbedPlayer({
  format,
  embedUrl,
  title,
}: {
  format: MediaLinkFormat;
  embedUrl: string;
  title: string;
}) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
      <iframe
        src={embedUrl}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <p className="sr-only">{format} embed</p>
    </div>
  );
}

export default async function LibraryWatchPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/library/watch/${encodeURIComponent(id)}`);
  }
  const entitlement = await getAccountEntitlement(user.id, user.email);
  if (!entitlement.allowed) redirect("/pricing?reason=membership-required");

  const { data: row } = await supabase
    .from("user_media_links")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();
  const link = row as UserMediaLink;

  return (
    <main className="min-h-screen bg-gls-black pb-24 pt-20">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        <div className="mb-4 flex items-center gap-3">
          <WatchBackButton href="/library" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gls-muted">
              My Links
            </p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              {link.title}
            </h1>
          </div>
        </div>

        {link.format === "youtube" || link.format === "vimeo" ? (
          link.embed_url ? (
            <EmbedPlayer
              format={link.format}
              embedUrl={link.embed_url}
              title={link.title}
            />
          ) : (
            <p className="text-sm text-amber-200">Embed URL missing for this link.</p>
          )
        ) : (
          <VideoPlayer item={toCatalog(link)} />
        )}

        <p className="mt-4 text-sm text-gls-muted">
          <Link href="/library" className="text-white underline-offset-2 hover:underline">
            Back to library
          </Link>
          {" · "}
          <Link href="/playlists" className="text-white underline-offset-2 hover:underline">
            My Playlists
          </Link>
        </p>
      </div>
    </main>
  );
}
