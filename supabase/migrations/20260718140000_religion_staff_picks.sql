-- Seed verified religion staff picks by faith folder (Islam / Gospel / Hindu tags).
-- URLs probed HTTP 200 against official Saudi / Iqraa / Islam Channel CDNs (2026-07-18).

INSERT INTO public.admin_media_links (url, title, format, category, is_published, notes)
VALUES
  (
    'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8',
    'Al Quran Al Kareem TV (Makkah)',
    'hls',
    'Islam',
    true,
    'Saudi Broadcasting Authority · live from Masjid al-Haram · Globecast official CDN'
  ),
  (
    'https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8',
    'Al Sunnah Al Nabawiyah TV (Madinah)',
    'hls',
    'Islam',
    true,
    'Saudi Broadcasting Authority · live from Masjid an-Nabawi · Globecast official CDN'
  ),
  (
    'https://media2.streambrothers.com:1936/8122/8122/playlist.m3u8',
    'Makkah TV',
    'hls',
    'Islam',
    true,
    'Makkah TV · official StreamBrothers CDN'
  ),
  (
    'https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv2/playlist.m3u8',
    'Iqraa Quran',
    'hls',
    'Islam',
    true,
    'Iqraa · Quran recitation and teaching · official FastTV CDN'
  ),
  (
    'https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv1/playlist.m3u8',
    'Iqraa Africa & Europe',
    'hls',
    'Islam',
    true,
    'Iqraa · Islamic education for Africa & Europe · official FastTV CDN'
  ),
  (
    'https://live.kwikmotion.com/sbrksaquranradiolive/srpksaquranradio/playlist.m3u8',
    'Holy Quran Radio (Saudi)',
    'hls',
    'Islam',
    true,
    'Saudi Broadcasting Authority · 24/7 Quran radio · official Kwikmotion CDN'
  ),
  (
    'https://live-islamtv-urdu.simplestreamcdn.com/live13/islamtv_urdu/bitrate1.isml/live.m3u8',
    'Islam Channel Urdu',
    'hls',
    'Islam',
    true,
    'Islam Channel · Urdu teaching · official Simplestream CDN'
  ),
  (
    'https://jstre.am/live/jsl:i1onRBELcGV.m3u8',
    'Hope Channel Africa',
    'hls',
    'Gospel',
    true,
    'Hope Channel · Christian faith programming for Africa · official JStream CDN'
  ),
  (
    'https://live.nixsat.com/play/rtm/index.m3u8',
    'Redemption TV Ministry',
    'hls',
    'Gospel',
    true,
    'Redemption TV · gospel and ministry · official Nixsat CDN'
  )
ON CONFLICT (url) DO UPDATE SET
  title = EXCLUDED.title,
  format = EXCLUDED.format,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published,
  notes = EXCLUDED.notes,
  updated_at = now();
