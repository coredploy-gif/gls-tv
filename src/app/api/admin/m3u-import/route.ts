import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient, normalizeSlug } from "@/lib/eadmin";
import { parseM3uDetailed } from "@/lib/iptv";
import { secureFetchBuffered, validatePublicUrl } from "@/lib/secure-url";
import { writeAuditLog } from "@/lib/admin/audit";
import {
  isAllowedMediaHost,
  isIndividualPlaylistUrl,
} from "@/lib/media-hosts";
import {
  getAdminAccess,
  hasAdminPermission,
  requireAal2,
} from "@/lib/admin/access";
import { isFeatureEnabled } from "@/lib/operations/feature-flags";
import { isExcludedBuiltinChannel } from "@/lib/builtin-catalog-policy";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_SOURCE_HOSTS = [
  "iptv-org.github.io",
  "raw.githubusercontent.com",
  "githubusercontent.com",
];

/** Multi-channel list hosts only — individual .m3u/.m3u8 skip this via fetchAndParse. */
function allowedListSource(hostname: string) {
  const configured = (process.env.GLS_ADMIN_M3U_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_SOURCE_HOSTS, ...configured].some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

function signingKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

function sign(url: string) {
  const payload = Buffer.from(
    JSON.stringify({ url, expires: Date.now() + 10 * 60_000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verify(token: string) {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !signingKey()) return null;
    const expected = createHmac("sha256", signingKey()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      url: string;
      expires: number;
    };
    return parsed.expires > Date.now() ? parsed.url : null;
  } catch {
    return null;
  }
}

async function gate() {
  const admin = await getAdminAccess();
  const service = createServiceClient();
  if (!admin || !hasAdminPermission(admin, "catalog.write")) return { error: "Forbidden", status: 403 } as const;
  if (!service || !signingKey()) return { error: "Admin service unavailable", status: 503 } as const;
  return { user: admin.user, admin, service } as const;
}

async function fetchAndParse(url: string) {
  // Individual .m3u / .m3u8 (any public host, incl. public-IP HTTP): skip catalogue
  // host allowlist like owned mediaLinkId plays — validatePublicUrl still blocks SSRF.
  // Non-playlist URLs (if any) keep the GitHub / configured list-host allowlist.
  const individualPlaylist = isIndividualPlaylistUrl(url);
  const fetched = await secureFetchBuffered(url, {
    maxBytes: 4 * 1024 * 1024,
    timeoutMs: 20_000,
    // jmp2.uk → aka-live*.delivery.roku.com (and similar FAST chains)
    maxRedirects: 5,
    allowedHost: individualPlaylist ? undefined : allowedListSource,
    headers: {
      Accept: "application/vnd.apple.mpegurl,audio/x-mpegurl,text/plain,*/*",
      "User-Agent": "GLS-TV/1.0 (admin-m3u-preview)",
    },
  });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error("Source download failed");
  const text = new TextDecoder().decode(fetched.body);
  return parseM3uDetailed(text, {
    baseUrl: fetched.finalUrl,
    maxChannels: 2000,
    // Keep the pasted entry URL (jmp2/pluto/public-IP) stable after CDN redirects.
    singleStreamUrl: url,
  });
}

export async function POST(req: Request) {
  const access = await gate();
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  let body: {
    action?: "preview" | "publish";
    url?: string;
    token?: string;
    mappings?: Array<{ index: number; targetSlug: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "preview") {
    const url = (body.url || "").trim();
    try {
      if (!signingKey()) throw new Error("Signing unavailable");
      const parsed = await fetchAndParse(url);
      if (!parsed.channels.length) {
        return NextResponse.json(
          {
            error: parsed.stats.kind.startsWith("hls-")
              ? "This is a single HLS stream, not a channel list"
              : "No valid channels found",
          },
          { status: 400 },
        );
      }
      const singleHls =
        parsed.stats.kind === "hls-master" || parsed.stats.kind === "hls-media";
      return NextResponse.json({
        token: sign(url),
        stats: parsed.stats,
        singleStream: singleHls,
        channels: parsed.channels.slice(0, 100).map((channel, index) => ({
          index,
          title: channel.title,
          group: channel.categories[0] || "General",
          tvgId: channel.tvgId,
          // Admin-only: needed for “Save as Staff picks” without catalog MFA.
          url: channel.sources[0]?.url || url,
        })),
        note: singleHls
          ? "Single HLS stream. Prefer Save as Staff picks (My Links) for members — catalog publish maps to licensed tiles and needs MFA (AAL2)."
          : "Preview only. Catalog publish maps selections to existing licensed catalog slugs (requires catalog permission + MFA). For individual member streams, use Save as Staff picks instead.",
      });
    } catch (cause) {
      const detail =
        cause instanceof Error && cause.message
          ? cause.message
          : "Source is unavailable";
      const playlist = isIndividualPlaylistUrl(url);
      return NextResponse.json(
        {
          error: playlist
            ? `Could not preview playlist (${detail}). Private/reserved IPs are blocked; the URL must return #EXTM3U.`
            : `Source is unavailable or not on the approved list-host allowlist (${detail}).`,
        },
        { status: 400 },
      );
    }
  }

  if (body.action !== "publish") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!hasAdminPermission(access.admin, "catalog.publish") || !requireAal2(access.admin)) {
    return NextResponse.json(
      {
        error:
          "Catalog publishing requires the catalog permission and verified MFA (AAL2). For individual streams members can use, choose Save as Staff picks instead (My Links → Staff picks) — that path does not need catalog MFA.",
      },
      { status: 403 },
    );
  }
  if (!(await isFeatureEnabled("catalog_publish", access.service))) {
    return NextResponse.json(
      { error: "Catalog publishing is disabled by the owner kill switch." },
      { status: 503 },
    );
  }
  const sourceUrl = verify(body.token || "");
  const mappings = (body.mappings || []).slice(0, 100);
  if (!sourceUrl || !mappings.length) {
    return NextResponse.json({ error: "Preview expired or no mappings selected" }, { status: 400 });
  }
  try {
    const parsed = await fetchAndParse(sourceUrl);
    const targetSlugs = [...new Set(mappings.map((item) => normalizeSlug(item.targetSlug)))];
    const { data: catalog } = await access.service
      .from("channels")
      .select("id, slug, title")
      .in("slug", targetSlugs);
    const approved = new Map((catalog || []).map((row) => [row.slug, row]));
    if (approved.size !== targetSlugs.length) {
      return NextResponse.json(
        { error: "Every mapping must target an existing published catalog slug" },
        { status: 400 },
      );
    }
    const channelIds = (catalog || []).map((row) => row.id);
    const { data: rights } = await access.service
      .from("content_rights")
      .select("channel_id, status, commercial_use, redistribution, proxy_permission, starts_at, expires_at")
      .in("channel_id", channelIds)
      .eq("status", "approved")
      .eq("commercial_use", true)
      .eq("redistribution", true)
      .eq("proxy_permission", true);
    const now = Date.now();
    const validRights = new Set(
      (rights || [])
        .filter((right) => (!right.starts_at || new Date(right.starts_at).getTime() <= now)
          && (!right.expires_at || new Date(right.expires_at).getTime() > now))
        .map((right) => right.channel_id),
    );
    if ((catalog || []).some((channel) => !validRights.has(channel.id))) {
      return NextResponse.json(
        { error: "Every target requires approved, current commercial, redistribution and proxy rights." },
        { status: 403 },
      );
    }
    const rows = mappings.map((mapping) => {
      const channel = parsed.channels[mapping.index];
      const slug = normalizeSlug(mapping.targetSlug);
      if (!channel || !approved.has(slug)) throw new Error("Invalid mapping");
      if (isExcludedBuiltinChannel(slug, approved.get(slug)!.title)) {
        throw new Error("Excluded built-in mapping");
      }
      return {
        slug,
        title: approved.get(slug)!.title,
        url: channel.sources[0].url,
        categories: channel.categories,
        countries: channel.countries,
        poster: channel.poster,
        backdrop: channel.backdrop,
        is_active: true,
        updated_by: access.user.id,
        updated_at: new Date().toISOString(),
      };
    });
    for (const row of rows) {
      await validatePublicUrl(row.url, isAllowedMediaHost);
    }
    const { error } = await access.service
      .from("stream_seeds")
      .upsert(rows, { onConflict: "slug" });
    if (error) throw error;
    await writeAuditLog(access.service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "admin_m3u.publish",
      entityType: "stream_seed",
      summary: `Published ${rows.length} approved M3U mapping(s)`,
      meta: { targetSlugs: rows.map((row) => row.slug) },
    });
    return NextResponse.json({
      ok: true,
      published: rows.map((row) => row.slug),
      message: "Mapped streams are live only on the existing published catalog tiles.",
    });
  } catch {
    return NextResponse.json({ error: "Approved mappings could not be published" }, { status: 500 });
  }
}
