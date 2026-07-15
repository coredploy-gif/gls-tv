export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  createdAt: number;
  kind: "activity" | "sports" | "account" | "system" | "billing" | "reminder";
  severity?: "info" | "warn" | "urgent";
};

export function notificationsStorageKey(viewerId: string) {
  return `gls-tv-notif-read-v1:${viewerId}`;
}

export function loadReadIds(viewerId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(notificationsStorageKey(viewerId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveReadIds(viewerId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    notificationsStorageKey(viewerId),
    JSON.stringify([...ids].slice(-200)),
  );
}

export function formatNotifTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
