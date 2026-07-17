import type { CatalogItem } from "@/data/types";
import { radioStation } from "@/data/curated-radio-shared";

/** Official Atunwa/StreamGuys — published on capitalfm.co.ke/listen/ (probed 2026-07). */
const CAPITAL_FM_KE = "https://atunwadigital.streamguys1.com/capitalfm";

/** Official StreamGuys — wazobiafm.com Lagos player (probed 2026-07). */
const WAZOBIA_LAGOS =
  "https://wazobiafmlagos951-atunwadigital.streamguys1.com/wazobiafmlagos951";
/** Official StreamGuys — coolfm.ng Lagos player (probed 2026-07). */
const COOL_FM_LAGOS =
  "https://coolfmlagos969-atunwadigital.streamguys1.com/coolfmlagos969";
/** Official StreamGuys — nigeriainfo.fm Lagos player (probed 2026-07). */
const NIGERIA_INFO_LAGOS =
  "https://nigeriainfofmlagos993-atunwadigital.streamguys1.com/nigeriainfofmlagos993";

/** Official Atunwa — peacefmonline.com/services/streaming embed (probed 2026-07). */
const PEACE_FM_GH = "https://peacefm-atunwadigital.streamguys1.com/peacefm";
/** Multimedia Group / Atunwa client — streamguys endpoint (probed 2026-07). */
const STARR_FM_GH = "https://starrfm-atunwadigital.streamguys1.com/starrfm";

/** ZBC mainradiostreaming CDN — National FM (probed 2026-07). */
const ZBC_NATIONAL_FM = "https://mainradiostreaming.zbc.co.zw:8020/national.mp3";

/**
 * Verified official / widely published African radio beyond SA + Malawi.
 * Only stations with HTTP 200 probes and official player pages.
 */
export const CURATED_RADIO_AFRICA: CatalogItem[] = [
  radioStation(
    "radio-capital-fm-ke",
    "radio-capital-fm-ke",
    "Capital FM",
    "Capital Group · urban hits · Nairobi 98.4 FM. Official capitalfm.co.ke live stream.",
    CAPITAL_FM_KE,
    ["ke"],
    "mp4",
    ["Capital", "Urban"],
    ["English"],
  ),
  radioStation(
    "radio-wazobia-lagos",
    "radio-wazobia-lagos",
    "Wazobia FM Lagos",
    "AIM Group · Pidgin talk & music · Lagos 95.1 FM. Official wazobiafm.com player.",
    WAZOBIA_LAGOS,
    ["ng"],
    "mp4",
    ["Wazobia", "Talk"],
    ["English", "Pidgin"],
  ),
  radioStation(
    "radio-cool-fm-lagos",
    "radio-cool-fm-lagos",
    "Cool FM Lagos",
    "AIM Group · contemporary hits · Lagos 96.9 FM. Official coolfm.ng player.",
    COOL_FM_LAGOS,
    ["ng"],
    "mp4",
    ["Cool FM", "Pop"],
    ["English"],
  ),
  radioStation(
    "radio-nigeria-info-lagos",
    "radio-nigeria-info-lagos",
    "Nigeria Info FM",
    "AIM Group · news & talk · Lagos 99.3 FM. Official nigeriainfo.fm player.",
    NIGERIA_INFO_LAGOS,
    ["ng"],
    "mp4",
    ["Nigeria Info", "News"],
    ["English"],
  ),
  radioStation(
    "radio-peace-fm-gh",
    "radio-peace-fm-gh",
    "Peace FM",
    "Despite Media · Accra 104.3 FM. Official peacefmonline.com streaming page.",
    PEACE_FM_GH,
    ["gh"],
    "mp4",
    ["Peace FM", "Talk"],
    ["English", "Twi"],
  ),
  radioStation(
    "radio-starr-fm-gh",
    "radio-starr-fm-gh",
    "Starr FM",
    "Multimedia Group · Accra. Official Atunwa/StreamGuys live endpoint.",
    STARR_FM_GH,
    ["gh"],
    "mp4",
    ["Starr FM", "Urban"],
    ["English"],
  ),
  radioStation(
    "radio-zbc-national-fm",
    "radio-zbc-national-fm",
    "ZBC National FM",
    "Zimbabwe Broadcasting Corporation · multilingual national service. Official ZBC streaming CDN.",
    ZBC_NATIONAL_FM,
    ["zw"],
    "mp4",
    ["ZBC", "Public"],
    ["English", "Shona", "Ndebele"],
  ),
];
