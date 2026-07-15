import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Missing public Supabase configuration");

const supabase = createClient(supabaseUrl, supabaseKey);
const { data, error } = await supabase
  .from("channels")
  .select("id,slug,title,countries,source_url,active_source_url,channel_sources(url,priority,label)")
  .or("slug.ilike.%arena%,title.ilike.%arena%,source_url.ilike.%arena%,active_source_url.ilike.%arena%")
  .order("slug");
if (error) throw error;

function firstUri(manifest) {
  return manifest
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
}

async function request(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers,
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") || "",
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url) {
  const glsHeaders = {
    "User-Agent": "GLS-TV/1.0 (media-proxy)",
    Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
    Referer: `${new URL(url).origin}/`,
  };
  let response;
  let headerMode = "plain";
  try {
    response = await request(url);
    if (!response.ok || !response.body.includes("#EXTM3U")) {
      response = await request(url, glsHeaders);
      headerMode = "gls";
    }
  } catch (plainError) {
    try {
      response = await request(url, glsHeaders);
      headerMode = "gls";
    } catch (headerError) {
      return {
        classification:
          headerError?.name === "AbortError" ? "timeout" : "network/tls",
        error: String(headerError?.message || plainError?.message || headerError),
      };
    }
  }

  const html = /text\/html/i.test(response.contentType) || /^\s*</.test(response.body);
  if (!response.ok || html || !response.body.includes("#EXTM3U")) {
    return {
      classification: html ? "html" : response.status === 403 ? "403/geo" : "not-hls",
      status: response.status,
      contentType: response.contentType,
      finalUrl: response.finalUrl,
      headerMode,
      prefix: response.body.slice(0, 100).replace(/\s+/g, " "),
    };
  }

  let manifest = response.body;
  let manifestUrl = response.finalUrl;
  let kind = /#EXT-X-STREAM-INF/i.test(manifest) ? "master" : "media";
  if (kind === "master") {
    const child = firstUri(manifest);
    if (!child) return { classification: "invalid-master", status: response.status };
    manifestUrl = new URL(child, response.finalUrl).href;
    try {
      const childResponse = await request(manifestUrl, glsHeaders);
      if (!childResponse.ok || !childResponse.body.includes("#EXTM3U")) {
        return {
          classification: "master-child-failed",
          status: childResponse.status,
          contentType: childResponse.contentType,
          finalUrl: childResponse.finalUrl,
        };
      }
      manifest = childResponse.body;
    } catch (childError) {
      return {
        classification: childError?.name === "AbortError" ? "child-timeout" : "child-network/tls",
        error: String(childError?.message || childError),
      };
    }
  }

  const mediaUri = firstUri(manifest);
  if (!mediaUri) {
    return { classification: "hls-no-media-uri", status: response.status, kind };
  }
  const mediaUrl = new URL(mediaUri, manifestUrl).href;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const media = await fetch(mediaUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { ...glsHeaders, Range: "bytes=0-4095" },
    });
    const bytes = new Uint8Array(await media.arrayBuffer());
    const container =
      bytes[0] === 0x47
        ? "mpeg-ts"
        : new TextDecoder().decode(bytes.slice(4, 12)).includes("ftyp")
          ? "fmp4"
          : "unknown";
    return {
      classification: media.ok ? "playable-hls" : "segment-failed",
      status: response.status,
      kind,
      headerMode,
      mediaStatus: media.status,
      mediaType: media.headers.get("content-type") || "",
      bytes: bytes.length,
      container,
      finalUrl: response.finalUrl,
      mediaHost: new URL(media.url).hostname,
    };
  } catch (mediaError) {
    return {
      classification: mediaError?.name === "AbortError" ? "segment-timeout" : "segment-network/tls",
      status: response.status,
      kind,
      error: String(mediaError?.message || mediaError),
    };
  } finally {
    clearTimeout(timer);
  }
}

for (const channel of data || []) {
  const urls = [
    channel.active_source_url,
    channel.source_url,
    ...(channel.channel_sources || []).map((source) => source.url),
  ].filter((url, index, all) => url && all.indexOf(url) === index);
  for (const url of urls) {
    console.log(
      JSON.stringify({
        id: channel.id,
        slug: channel.slug,
        title: channel.title,
        countries: channel.countries,
        url,
        ...(await probe(url)),
      }),
    );
  }
}
