import type { AppNotification } from "@/lib/notifications";

export type SoundPrefs = {
  sound_chat: boolean;
  sound_system: boolean;
  sound_admin: boolean;
  sound_billing: boolean;
};

export const DEFAULT_SOUND_PREFS: SoundPrefs = {
  sound_chat: true,
  sound_system: true,
  sound_admin: true,
  sound_billing: true,
};

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Call once after a user gesture so autoplay policies allow sounds. */
export function unlockNotificationAudio() {
  const ctx = getCtx();
  if (!ctx || unlocked) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.01);
  unlocked = true;
}

function tone(freq: number, durationMs: number, volume = 0.08) {
  const ctx = getCtx();
  if (!ctx || ctx.state === "suspended") return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}

export function playNotificationSound(kind: AppNotification["kind"], prefs: SoundPrefs) {
  unlockNotificationAudio();
  const enabled =
    kind === "billing" || kind === "account"
      ? prefs.sound_billing
      : kind === "reminder"
        ? prefs.sound_chat
        : kind === "system"
          ? prefs.sound_system
          : kind === "activity" || kind === "sports"
            ? prefs.sound_admin
            : true;
  if (!enabled) return;

  if (kind === "billing" || kind === "account") {
    tone(880, 120, 0.1);
    window.setTimeout(() => tone(660, 140, 0.09), 130);
    return;
  }
  if (kind === "reminder") {
    tone(520, 90, 0.07);
    return;
  }
  tone(440, 70, 0.06);
}

const SEEN_KEY = "gls-notif-sound-seen-v1";

export function loadSeenNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveSeenNotificationIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-120)));
}
