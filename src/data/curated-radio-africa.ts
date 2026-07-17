import type { CatalogItem } from "@/data/types";
import { radioStation } from "@/data/curated-radio-shared";

/** Official Atunwa/StreamGuys — published on capitalfm.co.ke/listen/ (probed 2026-07). */
const CAPITAL_FM_KE = "https://atunwadigital.streamguys1.com/capitalfm";
/** Radio Africa Group / StreamGuys — official player endpoints (probed 2026-07). */
const KISS_FM_KE = "https://kissfm-atunwadigital.streamguys1.com/kissfm";
const CLASSIC_105_KE =
  "https://classic105-atunwadigital.streamguys1.com/classic105";
const RADIO_JAMBO_KE =
  "https://radiojambo-atunwadigital.streamguys1.com/radiojambo";
const EAST_FM_KE = "https://eastfm-atunwadigital.streamguys1.com/eastfm";
const RADIO_MAISHA_KE =
  "https://radiomaisha-atunwadigital.streamguys1.com/radiomaisha";
const RADIO_CITIZEN_KE =
  "https://radiocitizen-atunwadigital.streamguys1.com/radiocitizen";
const INOORO_FM_KE =
  "https://inoorofm-atunwadigital.streamguys1.com/inoorofm";
const RAMOGI_FM_KE =
  "https://ramogifm-atunwadigital.streamguys1.com/ramogifm";
const KAMEME_FM_KE =
  "https://kamemefm-atunwadigital.streamguys1.com/kamemefm";
const SPICE_FM_KE = "https://spicefm-atunwadigital.streamguys1.com/spicefm";

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

/** ZBC official streaming CDNs (probed 2026-07). */
const ZBC_NATIONAL_FM = "https://mainradiostreaming.zbc.co.zw:8020/national.mp3";
const ZBC_RADIO_ZIMBABWE =
  "https://backupradiostreaming.zbc.co.zw:8040/nhepfenuro.mp3";

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
    ["English", "Swahili"],
  ),
  radioStation(
    "radio-kiss-fm-ke",
    "radio-kiss-fm-ke",
    "Kiss FM",
    "Radio Africa Group · Kenya's No. 1 hit music · Nairobi. Official StreamGuys live endpoint.",
    KISS_FM_KE,
    ["ke"],
    "mp4",
    ["Kiss FM", "Pop"],
    ["English", "Swahili"],
  ),
  radioStation(
    "radio-classic-105-ke",
    "radio-classic-105-ke",
    "Classic 105",
    "Radio Africa Group · good times & great hits · Nairobi. Official StreamGuys live endpoint.",
    CLASSIC_105_KE,
    ["ke"],
    "mp4",
    ["Classic 105", "Adult contemporary"],
    ["English"],
  ),
  radioStation(
    "radio-jambo-ke",
    "radio-jambo-ke",
    "Radio Jambo",
    "Radio Africa Group · Swahili urban & reggae · Nairobi. Official StreamGuys live endpoint.",
    RADIO_JAMBO_KE,
    ["ke"],
    "mp4",
    ["Radio Jambo", "Reggae"],
    ["Swahili", "English"],
  ),
  radioStation(
    "radio-east-fm-ke",
    "radio-east-fm-ke",
    "East FM",
    "Radio Africa Group · Asian community · Nairobi. Official StreamGuys live endpoint.",
    EAST_FM_KE,
    ["ke"],
    "mp4",
    ["East FM", "Community"],
    ["English", "Hindi", "Gujarati"],
  ),
  radioStation(
    "radio-maisha-ke",
    "radio-maisha-ke",
    "Radio Maisha",
    "Radio Africa Group · Swahili talk & news · Nairobi. Official StreamGuys live endpoint.",
    RADIO_MAISHA_KE,
    ["ke"],
    "mp4",
    ["Radio Maisha", "Talk"],
    ["Swahili", "English"],
  ),
  radioStation(
    "radio-citizen-ke",
    "radio-citizen-ke",
    "Radio Citizen",
    "Royal Media · news, talk & vernacular · Nairobi. Official StreamGuys live endpoint.",
    RADIO_CITIZEN_KE,
    ["ke"],
    "mp4",
    ["Citizen", "News"],
    ["Swahili", "English"],
  ),
  radioStation(
    "radio-inooro-ke",
    "radio-inooro-ke",
    "Inooro FM",
    "Royal Media · Kikuyu service · Nairobi region. Official StreamGuys live endpoint.",
    INOORO_FM_KE,
    ["ke"],
    "mp4",
    ["Inooro", "Kikuyu"],
    ["Kikuyu", "Swahili"],
  ),
  radioStation(
    "radio-ramogi-ke",
    "radio-ramogi-ke",
    "Ramogi FM",
    "Royal Media · Luo service · western Kenya. Official StreamGuys live endpoint.",
    RAMOGI_FM_KE,
    ["ke"],
    "mp4",
    ["Ramogi", "Luo"],
    ["Dholuo", "Swahili"],
  ),
  radioStation(
    "radio-kameme-ke",
    "radio-kameme-ke",
    "Kameme FM",
    "Royal Media · Kikuyu music & talk · central Kenya. Official StreamGuys live endpoint.",
    KAMEME_FM_KE,
    ["ke"],
    "mp4",
    ["Kameme", "Kikuyu"],
    ["Kikuyu", "Swahili"],
  ),
  radioStation(
    "radio-spice-ke",
    "radio-spice-ke",
    "Spice FM",
    "Radio Africa Group · lifestyle & talk · Nairobi. Official StreamGuys live endpoint.",
    SPICE_FM_KE,
    ["ke"],
    "mp4",
    ["Spice FM", "Talk"],
    ["English", "Swahili"],
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
  radioStation(
    "radio-zbc-radio-zimbabwe",
    "radio-zbc-radio-zimbabwe",
    "Radio Zimbabwe",
    "Zimbabwe Broadcasting Corporation · flagship Shona service (Nhepfenuro). Official ZBC backup CDN.",
    ZBC_RADIO_ZIMBABWE,
    ["zw"],
    "mp4",
    ["ZBC", "Public"],
    ["Shona", "English"],
  ),
];

/** One flagship station per expanded-Africa country for home browse rows. */
export const AFRICA_RADIO_BROWSE_FLAGSHIPS: Record<string, string> = {
  ke: "radio-capital-fm-ke",
  ng: "radio-wazobia-lagos",
  gh: "radio-peace-fm-gh",
  zw: "radio-zbc-national-fm",
};
