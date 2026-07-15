import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient, normalizeSlug } from "@/lib/eadmin";
import { parseM3uDetailed } from "@/lib/iptv";
import { secureFetchBuffered, validatePublicUrl } from "@/lib/secure-url";
import { writeAuditLog } from "@/lib/admin/audit";
import { isAllowedMediaHost } from "@/lib/media-hosts";
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

function allowedSource(hostname: string) {
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
  const fetched = await secureFetchBuffered(url, {
    maxBytes: 4 * 1024 * 1024,
    timeoutMs: 20_000,
    maxRedirects: 3,
    allowedHost: allowedSource,
    headers: {
      Accept: "application/vnd.apple.mpegurl,audio/x-mpegurl,text/plain",
      "User-Agent": "GLS-TV/1.0 (admin-m3u-preview)",
    },
  });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error("Source download failed");
  const text = new TextDecoder().decode(fetched.body);
  return parseM3uDetailed(text, {
    baseUrl: fetched.finalUrl,
    maxChannels: 2000,
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
      return NextResponse.json({
        token: sign(url),
        stats: parsed.stats,
        channels: parsed.channels.slice(0, 100).map((channel, index) => ({
          index,
          title: channel.title,
          group: channel.categories[0] || "General",
          tvgId: channel.tvgId,
        })),
        note: "Preview only. Publishing requires mapping each selection to an existing catalog slug.",
      });
    } catch {
      return NextResponse.json(
        { error: "Source is unavailable or not on the approved host list" },
        { status: 400 },
      );
    }
  }

  if (body.action !== "publish") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!hasAdminPermission(access.admin, "catalog.publish") || !requireAal2(access.admin)) {
    return NextResponse.json(
      { error: "Catalog publishing requires the catalog permission and verified MFA (AAL2)." },
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
