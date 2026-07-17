import "server-only";

import { createClient } from "@/lib/supabase/server";
import { COPY_FALLBACKS, t, type CopyKey } from "@/lib/copy";

/** Load DB overrides merged with code fallbacks. Server Components / API only. */
export async function getCopyMap(): Promise<Record<string, string>> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.from("app_copy").select("key, value");
    if (error || !data) return { ...COPY_FALLBACKS };
    const map: Record<string, string> = { ...COPY_FALLBACKS };
    for (const row of data) {
      if (row?.key && typeof row.value === "string" && row.value.trim()) {
        map[row.key] = row.value;
      }
    }
    return map;
  } catch {
    return { ...COPY_FALLBACKS };
  }
}

export async function getCopy(key: CopyKey | string): Promise<string> {
  const map = await getCopyMap();
  return t(key, map);
}
