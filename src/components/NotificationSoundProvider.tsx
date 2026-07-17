"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { AppNotification } from "@/lib/notifications";
import {
  DEFAULT_SOUND_PREFS,
  loadSeenNotificationIds,
  playNotificationSound,
  saveSeenNotificationIds,
  unlockNotificationAudio,
  type SoundPrefs,
} from "@/lib/notification-sounds";

const POLL_MS = 45_000;

/** Polls for new notifications and plays subtle sounds per user prefs. */
export function NotificationSoundProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const prefsRef = useRef<SoundPrefs>(DEFAULT_SOUND_PREFS);
  const seenRef = useRef<Set<string>>(loadSeenNotificationIds());
  const pollingRef = useRef(false);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/account", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const p = json.preferences;
        if (p) {
          prefsRef.current = {
            sound_chat: p.sound_chat !== false,
            sound_system: p.sound_system !== false,
            sound_admin: p.sound_admin !== false,
            sound_billing: p.sound_billing !== false,
          };
        }
      })
      .catch(() => {});
  }, [user]);

  const checkNew = useCallback(async (items?: AppNotification[]) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      let list = items;
      if (!list) {
        const res = await fetch("/api/membership/notifications?filter=unread&limit=20", {
          cache: "no-store",
        });
        const json = (await res.json()) as { items?: AppNotification[] };
        list = json.items || [];
      }
      const seen = seenRef.current;
      const fresh = list.filter((n) => !seen.has(n.id));
      for (const n of fresh) {
        playNotificationSound(n.kind, prefsRef.current);
        seen.add(n.id);
      }
      if (fresh.length) saveSeenNotificationIds(seen);
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void checkNew();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkNew();
    }, POLL_MS);
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ items?: AppNotification[] }>).detail;
      void checkNew(detail?.items);
    };
    window.addEventListener("gls:notifications-updated", onUpdate);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("gls:notifications-updated", onUpdate);
    };
  }, [user, checkNew]);

  return children;
}

export function notifyNotificationsUpdated(items?: AppNotification[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gls:notifications-updated", { detail: { items } }));
}
