import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrowseNav } from "@/components/BrowseNav";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WatchBackButton } from "@/components/WatchBackButton";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";
import { EvodLaunchPlayer } from "@/components/EvodLaunchPlayer";
import {
  adminMediaLinkToCatalog,
  isMediaExternalSiteFormat,
  isMediaIframeFormat,
  resolveMediaEmbedUrl,
  type AdminMediaLink,
  type MediaLinkFormat,
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

export default async function FeaturedMediaWatchPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/library/featured/${encodeURIComponent(id)}`);
  }
  const entitlement = await getAccountEntitlement(user.id, user.email);
  if (!entitlement.allowed) redirect("/pricing?reason=membership-required");

  const { data: row } = await supabase
    .from("admin_media_links")
    .select(
      "id, url, title, format, category, thumbnail_url, embed_url, video_id, is_published, notes, created_at",
    )
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (!row) notFound();
  const link = row as AdminMediaLink;
  const embedUrl = resolveMediaEmbedUrl(link);

  return (
    <main className="gls-below-nav min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-12">
        <div className="mb-4 flex items-center gap-3">
          <WatchBackButton fallbackHref="/library" label="Back to My Links" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gls-muted">
              Staff pick
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
          <VideoPlayer item={adminMediaLinkToCatalog(link)} />
        )}

        <p className="mt-4 text-sm text-gls-muted">
          Staff-curated playable link — not part of the licensed catalog.{" "}
          <Link href="/library" className="text-white underline-offset-2 hover:underline">
            Back to My Links
          </Link>
        </p>
      </div>
    </main>
  );
}
