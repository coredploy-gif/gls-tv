import type { CatalogItem } from "@/data/types";
import { RADIO_BACKDROP, RADIO_POSTER, radioStation } from "@/data/curated-radio-shared";

/** Official listen-live link published on radioislam.org.za (probed HTTP 200, 2026-07-18). */
export const RADIO_ISLAM_SA_URL =
  "https://cast1.my-control-panel.com/proxy/netmoham/radioislam.mp3";
/** Mirror on station domain — probed HTTP 200. */
export const RADIO_ISLAM_SA_MIRROR =
  "http://listen.radioislam.co.za:8080/radioislam.mp3";
/** Cii Radio (Channel Islam International) — official iono.fm live stream (probed HTTP 200). */
export const CHANNEL_ISLAM_INTERNATIONAL_URL =
  "https://edge.iono.fm/xice/109_medium.mp3";

const ZA = ["za"];

/** South African Islamic radio for /radio (ZA row). */
export const CURATED_RADIO_ZA_ISLAM = [
  radioStation(
    "radio-islam-sa",
    "radio-islam-sa",
    "Radio Islam",
    "Radio Islam International · 1548 AM Johannesburg — info-edutainment for the global Muslim community (official station stream).",
    RADIO_ISLAM_SA_URL,
    ZA,
    "mp4",
    ["Islam", "Religion"],
    ["English", "Urdu", "Arabic"],
  ),
  radioStation(
    "radio-channel-islam-international",
    "channel-islam-international",
    "Channel Islam International",
    "Cii Radio · English-language Islamic news, talk, and nasheeds — Johannesburg (official iono.fm stream).",
    CHANNEL_ISLAM_INTERNATIONAL_URL,
    ZA,
    "mp4",
    ["Islam", "Religion"],
    ["English"],
  ),
];

/** Same stations surfaced on /religion/islam with Religion-first categories. */
export const CURATED_RELIGION_ZA_ISLAM: CatalogItem[] = [
  {
    id: "curated-radio-islam-sa",
    slug: "radio-islam-sa",
    title: "Radio Islam",
    type: "live",
    description:
      "Radio Islam International · 1548 AM Johannesburg — Islamic info-edutainment and community programming (official radioislam.org.za stream).",
    countries: ZA,
    categories: ["Religion", "Islam", "Radio", "Curated", "Playable", "Verified"],
    languages: ["English", "Urdu", "Arabic"],
    poster: RADIO_POSTER,
    backdrop: RADIO_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: RADIO_ISLAM_SA_URL,
        quality: "Auto",
        format: "mp4",
        priority: 10,
        label: "radioislam-official",
      },
      {
        url: RADIO_ISLAM_SA_MIRROR,
        quality: "Auto",
        format: "mp4",
        priority: 20,
        label: "radioislam-mirror",
      },
    ],
  },
  {
    id: "curated-channel-islam-international",
    slug: "channel-islam-international",
    title: "Channel Islam International",
    type: "live",
    description:
      "Cii Radio · English-language Islamic news, education, and family programming — Johannesburg (official iono.fm stream).",
    countries: ZA,
    categories: ["Religion", "Islam", "Radio", "Curated", "Playable", "Verified"],
    languages: ["English"],
    poster: RADIO_POSTER,
    backdrop: RADIO_BACKDROP,
    license: "open_stream",
    isLive: true,
    sources: [
      {
        url: CHANNEL_ISLAM_INTERNATIONAL_URL,
        quality: "Auto",
        format: "mp4",
        label: "iono-official",
      },
    ],
  },
];
