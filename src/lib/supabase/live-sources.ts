import { createClient } from "@supabase/supabase-js";
import type { CatalogItem, MediaSource } from "@/data/types";
import {
  OPEN_FAST_BY_SLUG,
  isLinearSportsPack,
  isNumberedLinearSlot,
  sportsFamily,
} from "@/lib/sports-packs";
import { healChannelSources, isArenaPayLinear } from "@/lib/channel-heal";
import { isTraceChannel } from "@/lib/trace-mirrors";

function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function applyHeal(item: CatalogItem, sources: MediaSource[]): CatalogItem {
  const { sources: healed, tags, cleared } = healChannelSources({
    ...item,
    sources,
  });
  if (!healed.length && !cleared) return { ...item, sources };
  const linearPay =
    cleared ||
    tags.includes("LinearPay") ||
    tags.includes("Rights");
  return {
    ...item,
    sources: healed,
    description: linearPay
      ? `${item.title} is a linear pay-TV sports channel. GLS lists it for discovery and onboarding — use the official licensed provider in your territory (no open pirate HLS).`
      : item.description,
    categories: [
      ...new Set([
        ...item.categories.filter(
          (c) => c !== "NeedsUrl" && c !== "Playable" && c !== "Unavailable",
        ),
        ...tags,
      ]),
    ],
  };
}

/**
 * Merge sources for a catalog item.
 *
 * Critical: eadmin `stream_seeds` + same-slug channel_sources win.
 * Never swap TSN 1–5 / Fox numbered packs onto The Ocho / sister FASTs.
 * Then apply go-live healing (Trace Amagi, SABC mirrors, fragile demote).
 */
export async function withLiveSources(
  item: CatalogItem,
): Promise<CatalogItem> {
  try {
    const sb = browserClient();
    if (!sb) {
      return applyHeal(item, item.sources);
    }

    const primary: MediaSource[] = [];
    const secondary: MediaSource[] = [];
    const seen = new Set<string>();

    const push = (list: MediaSource[], s: MediaSource) => {
      if (!s.url || seen.has(s.url)) return;
      seen.add(s.url);
      list.push(s);
    };

    const { data: seed } = await sb
      .from("stream_seeds")
      .select("slug, title, url, is_active")
      .eq("slug", item.slug)
      .eq("is_active", true)
      .maybeSingle();

    if (seed?.url?.trim()) {
      push(primary, {
        url: seed.url.trim(),
        quality: "Auto",
        format: "hls",
        priority: 1,
        label: "eadmin-seed",
      });
    }

    const { data: channel } = await sb
      .from("channels")
      .select("id, slug, is_online, active_source_url, source_url, health_status")
      .eq("slug", item.slug)
      .maybeSingle();

    if (channel) {
      const own =
        (channel.active_source_url || channel.source_url || "").trim();
      if (own) {
        push(primary, {
          url: own,
          quality: "Auto",
          format: "hls",
          priority: 5,
          label: "channel-active",
        });
      }

      if (channel.id) {
        const { data: sources } = await sb
          .from("channel_sources")
          .select("url, priority, label, health_status")
          .eq("channel_id", channel.id)
          .in("health_status", ["healthy", "degraded"])
          .order("priority", { ascending: true });

        for (const s of sources || []) {
          push(primary, {
            url: s.url,
            quality: "Auto",
            format: "hls",
            priority: 10 + (s.priority ?? 100),
            label: s.label || undefined,
          });
        }
      }
    }

    const openFast = OPEN_FAST_BY_SLUG[item.slug];
    if (openFast) {
      push(primary, {
        url: openFast.url,
        quality: "Auto",
        format: "hls",
        priority: openFast.priority,
        label: openFast.label,
      });
    }

    for (const s of item.sources) {
      push(primary, { ...s, priority: (s.priority ?? 100) + 50 });
    }

    const family = sportsFamily(item);
    const mirrors = [...primary, ...secondary];
    if (!mirrors.length) {
      return applyHeal(item, item.sources);
    }

    const rightsManaged =
      isArenaPayLinear(item.slug, item.title) ||
      item.categories.includes("LinearPay") ||
      item.categories.includes("Rights");
    const seeded = Boolean(seed?.url?.trim()) && !rightsManaged;
    if (
      !seeded &&
      !isNumberedLinearSlot(item) &&
      !isTraceChannel(item.slug, item.title)
    ) {
      mirrors.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    }

    let healedItem = applyHeal(
      {
        ...item,
        title: seed?.title?.trim() || item.title,
        sources: mirrors,
      },
      mirrors,
    );

    // Keep eadmin seed first after heal injection
    if (seeded && seed?.url?.trim()) {
      const seedUrl = seed.url.trim();
      const rest = healedItem.sources.filter((s) => s.url !== seedUrl);
      healedItem = {
        ...healedItem,
        sources: [
          {
            url: seedUrl,
            quality: "Auto",
            format: "hls",
            priority: 1,
            label: "eadmin-seed",
          },
          ...rest,
        ],
      };
    }

    return {
      ...healedItem,
      categories: [
        ...new Set(
          (
            [
              ...healedItem.categories,
              seeded ? "Playable" : null,
              seeded ? "UserSeed" : null,
              family ? "LinearSports" : null,
              isLinearSportsPack(item) ? "LinearSports" : null,
              channel?.health_status === "healthy" ? "Playable" : null,
              channel?.health_status &&
              channel.health_status !== "healthy" &&
              !healedItem.categories.includes("Rights") &&
              !healedItem.categories.includes("LinearPay") &&
              !healedItem.categories.includes("Unavailable")
                ? "ProxyOk"
                : null,
            ] as (string | null)[]
          ).filter(Boolean) as string[],
        ),
      ],
    };
  } catch {
    return applyHeal(item, item.sources);
  }
}

export async function listActiveStreamSeeds() {
  try {
    const sb = browserClient();
    if (!sb) return [];
    const { data } = await sb
      .from("stream_seeds")
      .select(
        "slug, title, url, categories, countries, poster, backdrop, is_active",
      )
      .eq("is_active", true)
      .order("slug", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}
