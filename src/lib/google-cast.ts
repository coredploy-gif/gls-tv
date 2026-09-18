export type GoogleCastResult = "ok" | "unavailable" | "cancelled" | "error";

type CastSession = {
  loadMedia(request: unknown): Promise<unknown>;
};

type CastGlobals = Window & {
  __onGCastApiAvailable?: (available: boolean) => void;
  cast?: {
    framework: {
      CastContext: { getInstance(): {
        setOptions(options: unknown): void;
        requestSession(): Promise<string>;
        getCurrentSession(): CastSession | null;
      } };
    };
  };
  chrome?: {
    cast?: {
      AutoJoinPolicy: { ORIGIN_SCOPED: string };
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string;
        MediaInfo: new (url: string, contentType: string) => { metadata?: unknown };
        GenericMediaMetadata: new () => { title?: string; subtitle?: string; images?: unknown[] };
        Image: new (url: string) => unknown;
        LoadRequest: new (media: unknown) => unknown;
      };
    };
  };
};

let sdkPromise: Promise<boolean> | null = null;

export function castContentType(format?: string) {
  if (format === "hls") return "application/x-mpegURL";
  if (format === "dash") return "application/dash+xml";
  if (format === "webm") return "video/webm";
  return "video/mp4";
}

function loadCastSdk() {
  if (typeof window === "undefined") return Promise.resolve(false);
  const root = window as CastGlobals;
  if (root.cast?.framework && root.chrome?.cast?.media) return Promise.resolve(true);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 8_000);
    root.__onGCastApiAvailable = (available) => {
      window.clearTimeout(timeout);
      resolve(Boolean(available && root.cast?.framework && root.chrome?.cast?.media));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-gls-cast-sdk="true"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    script.async = true;
    script.dataset.glsCastSdk = "true";
    script.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/** Warm the sender SDK before the user clicks, preserving Cast's gesture requirement. */
export function prepareGoogleCast() {
  return loadCastSdk();
}

export async function castStreamToGoogleTv(input: {
  url: string;
  format?: string;
  title: string;
  poster?: string;
}): Promise<GoogleCastResult> {
  if (!/^https?:\/\//i.test(input.url)) return "unavailable";
  const root = window as CastGlobals;
  const alreadyReady = Boolean(root.cast?.framework && root.chrome?.cast?.media);
  if (!alreadyReady && !(await loadCastSdk())) return "unavailable";
  const framework = root.cast?.framework;
  const api = root.chrome?.cast;
  if (!framework || !api) return "unavailable";
  try {
    const context = framework.CastContext.getInstance();
    context.setOptions({
      receiverApplicationId: api.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: api.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    if (!context.getCurrentSession()) await context.requestSession();
    const session = context.getCurrentSession();
    if (!session) return "cancelled";
    const media = new api.media.MediaInfo(input.url, castContentType(input.format));
    const metadata = new api.media.GenericMediaMetadata();
    metadata.title = input.title;
    metadata.subtitle = "GLS TV";
    if (input.poster && /^https?:\/\//i.test(input.poster)) {
      metadata.images = [new api.media.Image(input.poster)];
    }
    media.metadata = metadata;
    await session.loadMedia(new api.media.LoadRequest(media));
    return "ok";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return /cancel/i.test(message) ? "cancelled" : "error";
  }
}
