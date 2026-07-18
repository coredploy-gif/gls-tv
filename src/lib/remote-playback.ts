/**
 * Cast / AirPlay helpers for native &lt;video&gt; (mp4 / native HLS).
 * YouTube/Vimeo iframes cannot use these APIs from our page.
 *
 * Important: hls.js / MSE attaches a blob: MediaSource URL. Chromium’s
 * Remote Playback API cannot hand that to Chromecast — prompt() often
 * AbortError / NotSupportedError. Detect MSE early and offer a fetchable
 * playlist URL (copy-link) instead of a scary “canceled” message.
 *
 * Radio (progressive mp4/audio) uses a real https src → Cast picker works.
 * Live TV (hls.js) needs the playlist/proxy URL passed separately as castUrl.
 */

export type CastCapability =
  | "remote-playback"
  | "airplay-picker"
  | "unavailable";

export type CastPromptResult =
  | "ok"
  | "unavailable"
  | "cancelled"
  | "error"
  | "mse-blocked";

type VideoWithWebkit = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
};

type VideoWithRemote = HTMLVideoElement & { remote?: RemotePlayback };

export type PromptCastOptions = {
  /**
   * Fetchable playlist / progressive URL (never a blob:). When MSE is
   * active, we skip Remote Playback prompt and surface this for copy-link.
   */
  castUrl?: string | null;
  /** Current source format — helps classify MSE live HLS vs native. */
  format?: string;
};

function remoteOf(video: HTMLVideoElement): RemotePlayback | undefined {
  return (video as VideoWithRemote).remote;
}

/** True when playback is driven by MediaSource / hls.js (blob: currentSrc). */
export function isMediaSourcePlayback(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  if (video.srcObject) return true;
  const src = video.currentSrc || video.src || "";
  if (src.startsWith("blob:")) return true;
  if (src.startsWith("mediasource:") || src.startsWith("mse:")) return true;
  return false;
}

/**
 * True when the element has no http(s)/same-origin src that Remotes can fetch.
 * Empty src while hls.js is attaching counts as non-castable.
 */
export function videoHasCastableSrc(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  if (isMediaSourcePlayback(video)) return false;
  const src = video.currentSrc || video.src || "";
  if (!src) return false;
  if (src.startsWith("blob:") || src.startsWith("mediasource:")) return false;
  return /^https?:\/\//i.test(src) || src.startsWith("/");
}

export function isSafariLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Exclude Chromium iOS / Chrome; include desktop & iOS Safari.
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/i.test(ua);
}

export function canPlayNativeHls(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  return Boolean(video.canPlayType("application/vnd.apple.mpegurl"));
}

export function castCapability(video: HTMLVideoElement | null): CastCapability {
  if (!video) return "unavailable";
  const remote = remoteOf(video);
  if (remote && typeof remote.prompt === "function") {
    return "remote-playback";
  }
  const webkit = video as VideoWithWebkit;
  if (typeof webkit.webkitShowPlaybackTargetPicker === "function") {
    return "airplay-picker";
  }
  return "unavailable";
}

/**
 * Whether a picker is likely to work for this element (not just that the API exists).
 * MSE/hls.js on Chromium is not castable via Remote Playback.
 */
export function castLikelyWorks(
  video: HTMLVideoElement | null,
  format: string | undefined,
): boolean {
  if (!streamSupportsCast(format)) return false;
  if (!video) return false;
  if (isMediaSourcePlayback(video) && !canPlayNativeHls(video)) {
    return false;
  }
  if (!videoHasCastableSrc(video) && !canPlayNativeHls(video)) {
    return false;
  }
  return castCapability(video) !== "unavailable";
}

/**
 * Show the Cast control when Remote Playback may work, or when we have a
 * fetchable castUrl fallback (matches radio discoverability for live HLS).
 */
export function shouldShowCastControl(
  format: string | undefined,
  castUrl?: string | null,
): boolean {
  if (streamSupportsCast(format)) return true;
  return Boolean(absoluteStreamUrl(castUrl ?? null));
}

/**
 * Prefer a fetchable playlist/progressive URL for Cast / copy-link.
 * Never returns blob:. Prefers public upstream HTTPS (Chromecast/VLC) over
 * a session-cookie `/api/hls` proxy URL when both exist.
 */
export function resolveCastUrl(
  playUrl: string | null | undefined,
  upstreamUrl?: string | null,
): string | null {
  const fromUpstream = absoluteStreamUrl(upstreamUrl ?? null);
  const fromPlay = absoluteStreamUrl(playUrl ?? null);

  const isPublicHttp = (u: string | null) =>
    Boolean(u && /^https?:\/\//i.test(u) && !u.includes("/api/hls"));

  if (isPublicHttp(fromUpstream)) return fromUpstream;
  if (isPublicHttp(fromPlay)) return fromPlay;
  if (fromPlay && !fromPlay.startsWith("blob:")) return fromPlay;
  if (fromUpstream && !fromUpstream.startsWith("blob:")) return fromUpstream;
  return null;
}

/**
 * MSE live HLS (or empty src mid-attach) cannot be handed to Chromecast.
 * Native HLS / progressive http(s) can.
 */
export function isMseCastBlocked(
  video: HTMLVideoElement | null,
  format?: string,
): boolean {
  if (!video) return false;
  if (canPlayNativeHls(video) && isSafariLike() && !isMediaSourcePlayback(video)) {
    return false;
  }
  if (isMediaSourcePlayback(video) && !canPlayNativeHls(video)) return true;
  // hls.js path before blob attaches, or after emptied — still not castable
  // via Remote Playback on Chromium.
  if (
    (format === "hls" || format === "dash") &&
    !videoHasCastableSrc(video) &&
    !canPlayNativeHls(video)
  ) {
    return true;
  }
  return false;
}

export async function promptCastOrAirPlay(
  video: HTMLVideoElement | null,
  opts?: PromptCastOptions,
): Promise<CastPromptResult> {
  if (!video) return "unavailable";

  // MSE blob / hls.js sources cannot be sent to Chromecast / most remotes.
  // Skip prompt() entirely — it often AbortError → looked like “canceled”.
  if (isMseCastBlocked(video, opts?.format)) {
    return "mse-blocked";
  }

  const kind = castCapability(video);

  if (kind === "remote-playback") {
    try {
      const remote = remoteOf(video);
      if (!remote || typeof remote.prompt !== "function") return "unavailable";
      await remote.prompt();
      return "ok";
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "AbortError") return "cancelled";
      // InvalidStateError / NotSupportedError: common for MSE or no devices.
      if (
        name === "NotSupportedError" ||
        name === "InvalidStateError" ||
        name === "NotFoundError"
      ) {
        return isMseCastBlocked(video, opts?.format) ||
          isMediaSourcePlayback(video)
          ? "mse-blocked"
          : "unavailable";
      }
      return "error";
    }
  }

  if (kind === "airplay-picker") {
    try {
      (video as VideoWithWebkit).webkitShowPlaybackTargetPicker?.();
      return "ok";
    } catch {
      return "error";
    }
  }

  // No picker API — still useful if we have a copyable stream URL.
  if (absoluteStreamUrl(opts?.castUrl ?? null)) {
    return streamSupportsCast(opts?.format) ? "mse-blocked" : "unavailable";
  }

  return "unavailable";
}

/** True when the current source can leave the page via Cast/AirPlay (in theory). */
export function streamSupportsCast(format: string | undefined): boolean {
  return format === "hls" || format === "mp4" || format === "dash";
}

export function absoluteStreamUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("blob:") || url.startsWith("mediasource:")) return null;
  try {
    if (/^https?:\/\//i.test(url)) return url;
    if (typeof window === "undefined") {
      // Relative paths need a document base; keep as-is for SSR callers
      // that only need a non-blob placeholder (PlayerChrome is client-only).
      return url.startsWith("/") ? url : null;
    }
    return new URL(url, window.location.href).href;
  } catch {
    return null;
  }
}

export type CastFeedback = {
  message: string;
  /** Offer “Copy stream link” when we have a fetchable URL. */
  copyUrl?: string | null;
};

/**
 * User-facing copy after a Cast click. Returns null when the user dismissed
 * the picker (no scary “canceled”). Otherwise always explains next steps.
 */
export function castFeedbackForResult(
  result: CastPromptResult,
  opts?: { format?: string; castUrl?: string | null },
): CastFeedback | null {
  const copyUrl = absoluteStreamUrl(opts?.castUrl ?? null);

  if (result === "ok") {
    return {
      message: isSafariLike()
        ? "Choose an AirPlay device from the picker."
        : "Choose a Cast device from the picker (or use Chrome’s Cast menu if none appear).",
    };
  }

  // User closed the picker — stay quiet (radio-like: no error toast).
  if (result === "cancelled") {
    return null;
  }

  if (result === "mse-blocked") {
    if (isSafariLike()) {
      return {
        message:
          "This live stream is playing in the browser buffer, so AirPlay can’t take it directly. Try Control Center → AirPlay, open this page in Safari, or copy the stream link below.",
        copyUrl,
      };
    }
    return {
      message: copyUrl
        ? "Chromecast can’t take this live HLS stream from the in-browser player. Copy the stream link for VLC/TV apps, use Chrome’s menu → Cast… (cast the tab), or open GLS TV on your TV’s browser."
        : "Chromecast can’t take this live HLS stream from the in-browser player. Use Chrome’s menu → Cast… to cast the tab, or open GLS TV on your TV’s browser.",
      copyUrl,
    };
  }

  if (result === "unavailable") {
    if (!streamSupportsCast(opts?.format) && !copyUrl) {
      return {
        message:
          "Cast isn’t available for this embed (e.g. YouTube). Open the channel on a TV browser instead.",
      };
    }
    if (isSafariLike()) {
      return {
        message:
          "No AirPlay device found. Use the video’s AirPlay control or Control Center, or open this page on your Apple TV.",
        copyUrl,
      };
    }
    return {
      message: copyUrl
        ? "No Cast device found here. Use Chrome’s Cast menu, open GLS TV on your TV’s browser, or copy the stream link below."
        : "No Cast device found here. On Android/desktop Chrome use the browser Cast menu, or open GLS TV on your TV’s browser.",
      copyUrl,
    };
  }

  // error
  return {
    message:
      "Couldn’t start Cast / AirPlay. Try Chrome’s Cast menu, AirPlay from Control Center, or open this page on your TV.",
    copyUrl,
  };
}
