import type { CatalogItem } from "@/data/types";
import { radioStation } from "@/data/curated-radio-shared";

/** Official MBC BroadWave high-rate MP3 (mbc.mw nav links — probed 2026-07). */
const MBC_RADIO_1 = "http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1";
const MBC_RADIO_2 = "http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1";

/** ZBS on SecureNet Systems (station 0079 — player at radio.securenetsystems.net/cwa/0079). */
const ZODIAK_RADIO = "https://ice31.securenetsystems.net/0079";

/**
 * Verified Malawi radio — MBC BroadWave + ZBS SecureNet Icecast streams.
 * Linear TV: see curated-malawi-tv.ts (official mbc.mw/live BozzTV HLS).
 */
export const CURATED_RADIO_MW: CatalogItem[] = [
  radioStation(
    "radio-mbc-1",
    "radio-mbc-1",
    "MBC Radio 1",
    "Malawi Broadcasting Corporation · national service (English & Chichewa).",
    MBC_RADIO_1,
    ["mw"],
    "mp4",
    ["MBC", "Public"],
  ),
  radioStation(
    "radio-mbc-2",
    "radio-mbc-2",
    "MBC Radio 2",
    "Malawi Broadcasting Corporation · Radio 2 (urban & youth).",
    MBC_RADIO_2,
    ["mw"],
    "mp4",
    ["MBC", "Public"],
  ),
  radioStation(
    "radio-zodiak",
    "radio-zodiak",
    "Zodiak Radio",
    "Zodiak Broadcasting Station · national news, talk & music (Chichewa & English).",
    ZODIAK_RADIO,
    ["mw"],
    "mp4",
    ["ZBS", "Private"],
  ),
];
