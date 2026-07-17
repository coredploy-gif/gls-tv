import "server-only";

import { secureFetchBuffered } from "@/lib/secure-url";
import type { MediaLinkFormat, MediaLinkStatus } from "@/lib/media-links";

export type MediaLinkProbeResult = {
  ok: boolean;
  status: MediaLinkStatus;
  detail?: string;
};

/**
 * Server-only reachability probe (uses Node secure-url / dns).
 * Keep this out of client bundles — MediaLibrary imports media-links.ts only.
 */
export async function probeMediaLinkReachability(
  url: string,
  format: MediaLinkFormat,
): Promise<MediaLinkProbeResult> {
  if (format === "youtube" || format === "vimeo") {
    return { ok: true, status: "active", detail: "Embed format verified" };
  }

  try {
    const result = await secureFetchBuffered(url, {
      maxBytes: format === "hls" ? 64_000 : 8_192,
      timeoutMs: 10_000,
      headers: {
        "User-Agent": "GLS-TV/1.0 media-link-probe",
        Accept: "*/*",
        ...(format === "mp4" || format === "webm"
          ? { Range: "bytes=0-1023" }
          : {}),
      },
    });

    if (result.status >= 400) {
      return {
        ok: false,
        status: "dead",
        detail: `URL returned HTTP ${result.status}`,
      };
    }

    if (format === "hls") {
      const text = result.body.toString("utf8").slice(0, 512);
      if (!/#EXTM3U/i.test(text)) {
        return {
          ok: false,
          status: "error",
          detail: "URL did not return an HLS playlist (#EXTM3U).",
        };
      }
    }

    return { ok: true, status: "active", detail: "Reachable" };
  } catch (cause) {
    return {
      ok: false,
      status: "error",
      detail:
        cause instanceof Error
          ? cause.message
          : "Could not reach that URL from our servers.",
    };
  }
}
