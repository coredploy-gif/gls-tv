/**
 * Cast / AirPlay helpers for native &lt;video&gt; (mp4 / HLS).
 * YouTube/Vimeo iframes cannot use these APIs from our page.
 */

export type CastCapability =
  | "remote-playback"
  | "airplay-picker"
  | "unavailable";

type VideoWithWebkit = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
};

export function castCapability(video: HTMLVideoElement | null): CastCapability {
  if (!video) return "unavailable";
  const remote = (video as HTMLVideoElement & { remote?: RemotePlayback }).remote;
  if (remote && typeof remote.prompt === "function") {
    return "remote-playback";
  }
  const webkit = video as VideoWithWebkit;
  if (typeof webkit.webkitShowPlaybackTargetPicker === "function") {
    return "airplay-picker";
  }
  return "unavailable";
}

export async function promptCastOrAirPlay(
  video: HTMLVideoElement | null,
): Promise<"ok" | "unavailable" | "cancelled" | "error"> {
  if (!video) return "unavailable";
  const kind = castCapability(video);

  if (kind === "remote-playback") {
    try {
      const remote = (video as HTMLVideoElement & { remote: RemotePlayback }).remote;
      await remote.prompt();
      return "ok";
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "AbortError") return "cancelled";
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

/** True when the current source can leave the page via Cast/AirPlay. */
export function streamSupportsCast(format: string | undefined): boolean {
  return format === "hls" || format === "mp4" || format === "dash";
}
