/**
 * Curated Full HD / 4K photographic art for home + hub Top 10 channels.
 * Keeps IPTV logos from painting blank posters on main screens.
 */

const poster = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&h=2400&q=92`;
const backdrop = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=3840&h=2160&q=92`;

export type ChannelArt = {
  poster: string;
  backdrop: string;
};

function art(id: string): ChannelArt {
  return { poster: poster(id), backdrop: backdrop(id) };
}

/** Unique cinematic stills keyed by slug (home / sports / kids / news / food). */
export const CURATED_CHANNEL_ART: Record<string, ChannelArt> = {
  // Sports / home hero — extreme + stadium variety
  "red-bull-tv": art("photo-1551524559-8af4e6624178"),
  "redbulltv-at-sd": art("photo-1522163189787-03190bc2697a"),
  "atglive-se-sd": art("photo-1558618666-fcd25c85cd64"),
  "draftkingsnetwork-us-sd": art("photo-1508098682721-e5dbc6094189"),
  "fueltv-pt-au": art("photo-1502680390469-be75c87ebe73"),
  "fueltv-pt-emea": art("photo-1459865264687-595d652de67e"),
  "kcmnld426-us-sd": art("photo-1492144534655-ae79c964c9d7"),
  "mtrspt1-us-hd": art("photo-1568605117036-5fe5e7bab0b7"),
  "pac12insider-us-sd": art("photo-1574629810360-7efbbe195018"),
  "racerinternational-pl-fast": art("photo-1517940310602-285956722135"),

  // News
  "al-jazeera-english": art("photo-1495020689067-958852a7765e"),
  "dw-english": art("photo-1504711434869-e1e241b58b61"),
  "france-24-english": art("photo-1523995462485-3d171b5c8fa9"),
  reuters: art("photo-1513635269975-59663e0ac1ad"),
  "abc-news-live": art("photo-1504711332673-fb914d329d74"),
  "americasvoice-us-sd": art("photo-1585829365295-ab7cd400c167"),
  "blacknewschannel-us-sd": art("photo-1557597774-9d8d26f2d0a7"),
  "cbsnewsbaltimore-us-sd": art("photo-1504711434869-e1e241b58b61"),
  "cbsnewsmiami-us-sd": art("photo-1523995462485-3d171b5c8fa9"),
  "cbsnewssacramento-us-sd": art("photo-1585829365295-ab7cd400c167"),

  // Kids
  "mrbeananimated-uk-fr": art("photo-1566576912321-d58ddd7a6088"),
  "mrbeananimated-uk-it": art("photo-1515488042361-ee00e0ddd4e4"),
  "mrbeananimated-uk-es": art("photo-1471286174890-9c112ffca5b4"),
  "mrbeanliveaction-uk-english": art("photo-1596464716127-f2a82984de30"),
  "chithiram-in-sd": art("photo-1503454537195-1dcabb73ffb9"),
  "happykids-us-sd": art("photo-1587654780291-39c9404d749b"),
  "kika-de-sd": art("photo-1515488042361-ee00e0ddd4e4"),
  "ninjakidztv-us-sd": art("photo-1566576912321-d58ddd7a6088"),
  "legochannel-us-sd": art("photo-1587654780291-39c9404d749b"),
  "toongoggles-us-sd": art("photo-1503454537195-1dcabb73ffb9"),

  // Food
  "inthekitchen-us-sd": art("photo-1556909114-f6e7ad7d3136"),
  "chefchampion-us-sd": art("photo-1504674900247-0877df9cc836"),
  "chefrocshow-us-sd": art("photo-1414235077428-338989a2e8c0"),
  "jordankitchen-jo-sd": art("photo-1467003909585-2f8a72700288"),
  "bonappetit-us-sd": art("photo-1540189549336-e6e99c3679fe"),
  "tastemade-us-us": art("photo-1565299624946-b28f40a0ae38"),
  "bbcfood-us-sd": art("photo-1493770348161-369560ae357d"),
  "foodfood-in-sd": art("photo-1555939594-58d7cb561ad1"),
  "kulinartv-ru-sd": art("photo-1473093295043-cdd812d0e601"),
  "gustotv-ca-poland": art("photo-1517248135467-4c7edcad34c4"),
};

export function curatedArtForSlug(slug: string): ChannelArt | null {
  return CURATED_CHANNEL_ART[slug] ?? null;
}
