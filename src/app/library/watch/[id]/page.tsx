import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchBackButton } from "@/components/WatchBackButton";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";
import { EvodLaunchPlayer } from "@/components/EvodLaunchPlayer";
import {
  isMediaExternalSiteFormat,
  isMediaIframeFormat,
  resolveMediaEmbedUrl,
  userMediaLinkToCatalog,
  type MediaLinkFormat,
  type UserMediaLink,
} from "@/lib/media-links";

type Props = { params: Promise<{ id: string }> };

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
  const embedUrl = resolveMediaEmbedUrl(link);

  // Fire-and-forget recently watched stamp (RLS-scoped).
  void supabase
    .from("user_media_links")
    .update({ last_watched_at: new Date().toISOString() })
    .eq("id", link.id)
    .eq("user_id", user.id);

  return (
    <main className="gls-below-nav min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        <div className="mb-4 flex items-center gap-3">
          <WatchBackButton fallbackHref="/library" label="Back to My Links" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gls-muted">
              My Links
            </p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              {link.title}
            </h1>
          </div>
        </div>

        {isMediaIframeFormat(link.format) ? (
          embedUrl ? (
            <EmbedPlayer
              format={link.format}
              embedUrl={embedUrl}
              title={link.title}
            />
          ) : (
            <p className="text-sm text-amber-200">Embed URL missing for this link.</p>
          )
        ) : isMediaExternalSiteFormat(link.format) ? (
          embedUrl ? (
            <EvodLaunchPlayer url={embedUrl} title={link.title} />
          ) : (
            <p className="text-sm text-amber-200">eVOD URL missing for this link.</p>
          )
        ) : (
          <VideoPlayer item={userMediaLinkToCatalog(link)} />
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
