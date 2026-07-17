/**
 * Cast / AirPlay helpers for native &lt;video&gt; (mp4 / native HLS).
 * YouTube/Vimeo iframes cannot use these APIs from our page.
 *
 * Important: hls.js / MSE attaches a blob: MediaSource URL. Chromium’s
 * Remote Playback API cannot hand that to Chromecast — prompt() often
 * resolves with no useful UI or fails quietly. Detect MSE and explain.
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

function remoteOf(video: HTMLVideoElement): RemotePlayback | undefined {
  return (video as VideoWithRemote).remote;
}

/** True when playback is driven by MediaSource / hls.js (blob: currentSrc). */
export function isMediaSourcePlayback(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const src = video.currentSrc || video.src || "";
  if (src.startsWith("blob:")) return true;
  if (video.srcObject) return true;
  return false;
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
  return castCapability(video) !== "unavailable";
}

export async function promptCastOrAirPlay(
  video: HTMLVideoElement | null,
): Promise<CastPromptResult> {
  if (!video) return "unavailable";

  // MSE blob sources cannot be sent to Chromecast / most remotes.
  if (isMediaSourcePlayback(video) && !canPlayNativeHls(video)) {
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
        return isMediaSourcePlayback(video) ? "mse-blocked" : "unavailable";
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

  return "unavailable";
}

/** True when the current source can leave the page via Cast/AirPlay (in theory). */
export function streamSupportsCast(format: string | undefined): boolean {
  return format === "hls" || format === "mp4" || format === "dash";
}

export function absoluteStreamUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    if (/^https?:\/\//i.test(url)) return url;
    if (typeof window === "undefined") return null;
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
 * User-facing copy after a Cast click. Always returns a message unless the
 * OS picker opened successfully (caller may still show a brief “Opening…”).
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

  if (result === "cancelled") {
    return { message: "Cast cancelled." };
  }

  if (result === "mse-blocked") {
    if (isSafariLike()) {
      return {
        message:
          "This stream is playing via a browser buffer that AirPlay can’t use. On iPhone/iPad, try Control Center → AirPlay, or open this page in Safari.",
        copyUrl,
      };
    }
    return {
      message:
        "Chromecast can’t receive this live HLS stream from the player (buffered in-browser). Use Chrome’s menu → Cast… to cast the tab, open GLS TV on your TV browser, or copy the stream link below.",
      copyUrl,
    };
  }

  if (result === "unavailable") {
    if (!streamSupportsCast(opts?.format)) {
      return {
        message:
          "Cast isn’t available for this embed (e.g. YouTube). Open the channel on a TV browser instead.",
      };
    }
    if (isSafariLike()) {
      return {
        message:
          "AirPlay isn’t available here. Use the video’s AirPlay control or Control Center, or open this page on your Apple TV.",
        copyUrl,
      };
    }
    return {
      message:
        "Cast isn’t available in this browser. On Android/desktop Chrome use the browser Cast menu, or open GLS TV on your TV’s browser.",
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
