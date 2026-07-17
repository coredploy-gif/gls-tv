-- Polish African radio staff picks: dedupe curated /radio catalog, hide offline MBC TV.

-- MBC TV BozzTV HLS returns 404 (2026-07-18) — hide from staff picks until CDN heals.
UPDATE public.admin_media_links
SET
  is_published = false,
  notes = coalesce(notes, '') || ' · hidden — BozzTV CDN 404 (2026-07-18 probe); use /radio for MBC audio',
  updated_at = now()
WHERE url IN (
  'https://glb.bozztv.com/glb/ssh101/kwacha/index.m3u8',
  'https://ssh101-fl.bozztv.com/ssh101/mbctv2mw/index.m3u8'
);

-- Radio staff picks mirror the static /radio curated catalog — unpublish to avoid duplicate tiles.
UPDATE public.admin_media_links
SET
  is_published = false,
  notes = coalesce(notes, '') || ' · hidden — served via /radio curated catalog (dedup 2026-07-18)',
  updated_at = now()
WHERE category = 'Radio'
  AND is_published = true
  AND url IN (
    -- South Africa (StreamTheWorld + Bok Radio)
    'https://playerservices.streamtheworld.com/api/livestream-redirect/METROFM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/5FM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/KFM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/RSG.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/SAFM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO2000.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/UKHOZIFM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/LOTUSFM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/GOODHOPEFM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/TRUFM.mp3',
    'https://playerservices.streamtheworld.com/api/livestream-redirect/LESEDI.mp3',
    'https://livestream2.bokradio.co.za/hls/Bok5c.m3u8',
    -- Malawi
    'http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1',
    'http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1',
    'http://radiostream.mbc.mw:88/broadwave.mp3?src=Radio1&rate=1',
    'http://radiostream.mbc.mw:88/broadwave.mp3?src=Radio2&rate=1',
    'https://ice31.securenetsystems.net/0079',
    -- Kenya
    'https://atunwadigital.streamguys1.com/capitalfm',
    'https://kissfm-atunwadigital.streamguys1.com/kissfm',
    'https://classic105-atunwadigital.streamguys1.com/classic105',
    'https://radiojambo-atunwadigital.streamguys1.com/radiojambo',
    'https://eastfm-atunwadigital.streamguys1.com/eastfm',
    'https://radiomaisha-atunwadigital.streamguys1.com/radiomaisha',
    'https://radiocitizen-atunwadigital.streamguys1.com/radiocitizen',
    'https://inoorofm-atunwadigital.streamguys1.com/inoorofm',
    'https://ramogifm-atunwadigital.streamguys1.com/ramogifm',
    'https://kamemefm-atunwadigital.streamguys1.com/kamemefm',
    'https://spicefm-atunwadigital.streamguys1.com/spicefm',
    -- Nigeria
    'https://wazobiafmlagos951-atunwadigital.streamguys1.com/wazobiafmlagos951',
    'https://coolfmlagos969-atunwadigital.streamguys1.com/coolfmlagos969',
    'https://nigeriainfofmlagos993-atunwadigital.streamguys1.com/nigeriainfofmlagos993',
    -- Ghana
    'https://peacefm-atunwadigital.streamguys1.com/peacefm',
    'https://starrfm-atunwadigital.streamguys1.com/starrfm',
    -- Zimbabwe
    'https://mainradiostreaming.zbc.co.zw:8020/national.mp3',
    'https://backupradiostreaming.zbc.co.zw:8040/nhepfenuro.mp3'
  );

-- Normalize any lingering published radio titles (legacy seeds).
UPDATE public.admin_media_links
SET
  title = 'Capital FM',
  updated_at = now()
WHERE url = 'https://atunwadigital.streamguys1.com/capitalfm'
  AND title <> 'Capital FM';

UPDATE public.admin_media_links
SET
  title = 'Nigeria Info FM',
  updated_at = now()
WHERE url = 'https://nigeriainfofmlagos993-atunwadigital.streamguys1.com/nigeriainfofmlagos993'
  AND title LIKE '%Lagos%';
