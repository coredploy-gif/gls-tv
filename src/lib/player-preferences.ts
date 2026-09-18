export const PLAYER_VOLUME_KEY = "gls-player-volume-v1";

export function safePlayerVolume(value: unknown, fallback = 1) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

export function readPlayerVolume() {
  if (typeof window === "undefined") return 1;
  return safePlayerVolume(localStorage.getItem(PLAYER_VOLUME_KEY), 1);
}

export function writePlayerVolume(value: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYER_VOLUME_KEY, String(safePlayerVolume(value)));
}
