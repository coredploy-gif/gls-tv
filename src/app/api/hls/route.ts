import https from "https";
import http from "http";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

function isPrivateHost(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return true;
  }
  const m = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isAllowedUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (isPrivateHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function proxyUrl(absolute: string, req: NextRequest) {
  return `${req.nextUrl.origin}/api/hls?url=${encodeURIComponent(absolute)}`;
}

function rewritePlaylist(body: string, baseUrl: string, req: NextRequest) {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_m, uri: string) => {
          try {
            return `URI="${proxyUrl(new URL(uri, baseUrl).href, req)}"`;
          } catch {
            return _m;
          }
        });
      }
      try {
        return proxyUrl(new URL(trimmed, baseUrl).href, req);
      } catch {
        return line;
      }
    })
    .join("\n");
}

/** CDN-aware browser headers — helps some origins; cannot bypass true IP geo. */
function headersFor(target: string, rangeHeader?: string | null) {
  const url = new URL(target);
  const host = url.hostname.toLowerCase();
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "*/*",
    Connection: "keep-alive",
    "Accept-Language": "en-ZA,en;q=0.9",
  };

  if (
    host.includes("mangomolo") ||
    host.includes("sabc") ||
    host.includes("sabconeta") ||
    host.includes("sabctwo") ||
    host.includes("sabctre")
  ) {
    headers.Referer = "https://www.sabcplus.com/";
    headers.Origin = "https://www.sabcplus.com";
    headers.Accept = "application/vnd.apple.mpegurl,application/x-mpegURL,*/*";
  } else if (host.includes("bozztv")) {
    headers.Referer = `${url.origin}/`;
    headers.Origin = url.origin;
  } else if (
    host.includes("trace.plus") ||
    host.includes("channels.trace") ||
    host.includes("trace.tv") ||
    host.includes("tracetv")
  ) {
    headers.Referer = "https://www.trace.tv/";
    headers.Origin = "https://www.trace.tv";
    headers.Accept = "application/vnd.apple.mpegurl,application/x-mpegURL,*/*";
  } else if (host.includes("freevisiontv") || host.includes("sentech")) {
    headers.Referer = "https://www.freevisiontv.co.za/";
    headers.Origin = "https://www.freevisiontv.co.za/";
  } else if (host.includes("telemedia") || host.includes("afxp")) {
    headers.Referer = "https://www.afrikanprestige.co.za/";
    headers.Origin = `${url.protocol}//${url.hostname}/`;
  } else if (
    host.includes("jmp2.uk") ||
    host.includes("pluto.tv") ||
    host.includes("plutotv.net")
  ) {
    // jmp2 redirects into Pluto stitcher; relative playlist paths need Pluto auth
    headers.Referer = "https://pluto.tv/";
    headers.Origin = "https://pluto.tv";
  } else if (host.includes("xumo") || host.includes("wurl.tv")) {
    headers.Referer = "https://www.xumo.tv/";
    headers.Origin = "https://www.xumo.tv";
  } else {
    headers.Referer = `${url.origin}/`;
  }

  if (rangeHeader) headers.Range = rangeHeader;
  return headers;
}

type Upstream = {
  status: number;
  /** Final URL after redirects — required so relative m3u8 paths resolve correctly. */
  finalUrl: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

async function fetchUpstream(
  target: string,
  rangeHeader?: string | null,
): Promise<Upstream> {
  const headers = headersFor(target, rangeHeader);

  return new Promise((resolve, reject) => {
    const url = new URL(target);
    const lib = url.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: url.pathname + url.search,
        method: "GET",
        agent: url.protocol === "https:" ? httpsAgent : undefined,
        headers,
        timeout: 25000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const status = res.statusCode || 502;
          if (
            status >= 300 &&
            status < 400 &&
            res.headers.location &&
            typeof res.headers.location === "string"
          ) {
            const next = new URL(res.headers.location, target).href;
            if (!isAllowedUrl(next)) {
              reject(new Error("Redirect blocked"));
              return;
            }
            // Keep following with headers for the *next* host (e.g. jmp2 → Pluto)
            fetchUpstream(next, rangeHeader).then(resolve, reject);
            return;
          }
          resolve({
            status,
            finalUrl: target,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Upstream timeout"));
    });
    req.end();
  });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: string;
  try {
    target = decodeURIComponent(raw);
  } catch {
    return NextResponse.json({ error: "Bad url" }, { status: 400 });
  }

  if (!isAllowedUrl(target)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const range = req.headers.get("range");
    const upstream = await fetchUpstream(target, range);
    if (upstream.status >= 400) {
      const probe = upstream.body.toString("utf8").slice(0, 200).toLowerCase();
      const geo =
        upstream.status === 403 &&
        (probe.includes("region") ||
          probe.includes("not available") ||
          probe.includes("forbidden"));
      return NextResponse.json(
        {
          error: geo
            ? "This channel is unavailable in this region."
            : "This programme isn’t available right now.",
          geo,
        },
        { status: upstream.status },
      );
    }

    const contentType = String(upstream.headers["content-type"] || "");
    const textProbe = upstream.body.subarray(0, 64).toString("utf8");
    const bodyHead = upstream.body.subarray(0, 512).toString("utf8").toLowerCase();
    if (
      bodyHead.includes("blocked.grouptag") ||
      bodyHead.includes("passthrough?data=") ||
      (contentType.includes("text/html") && !textProbe.includes("#EXT"))
    ) {
      return NextResponse.json(
        {
          error:
            "This programme isn’t available right now.",
          blocked: true,
        },
        { status: 502 },
      );
    }

    const looksPlaylist =
      textProbe.includes("#EXT") ||
      contentType.includes("mpegurl") ||
      contentType.includes("m3u8") ||
      target.includes(".m3u8");

    if (looksPlaylist) {
      const text = upstream.body.toString("utf8");
      if (text.includes("#EXT")) {
        // Critical: rewrite against finalUrl (after jmp2→Pluto redirects).
        // Using the original jmp2 URL makes relative paths 404 and kills
        // The L Word / Star Trek / Walking Dead and similar Pluto FASTs.
        const rewritten = rewritePlaylist(text, upstream.finalUrl || target, req);
        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        });
      }
      return NextResponse.json(
        { error: "This programme isn’t available right now.", blocked: true },
        { status: 502 },
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=4",
      "Accept-Ranges": "bytes",
    };
    if (upstream.headers["content-range"]) {
      headers["Content-Range"] = String(upstream.headers["content-range"]);
    }
    if (upstream.headers["content-length"]) {
      headers["Content-Length"] = String(upstream.headers["content-length"]);
    }

    return new NextResponse(new Uint8Array(upstream.body), {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch (err) {
    console.error("HLS playback request failed", err);
    return NextResponse.json(
      { error: "This programme isn’t available right now." },
      { status: 502 },
    );
  }
}
