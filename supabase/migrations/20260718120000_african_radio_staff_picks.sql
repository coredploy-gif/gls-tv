-- Seed verified African radio stations (Kenya, Nigeria, Ghana, Zimbabwe) as staff picks.
-- URLs probed HTTP 200 against official broadcaster player pages (2026-07-18).

INSERT INTO public.admin_media_links (url, title, format, category, is_published, notes)
VALUES
  (
    'https://atunwadigital.streamguys1.com/capitalfm',
    'Capital FM Kenya',
    'mp4',
    'Radio',
    true,
    'Capital Group · official capitalfm.co.ke/listen/ StreamGuys endpoint'
  ),
  (
    'https://wazobiafmlagos951-atunwadigital.streamguys1.com/wazobiafmlagos951',
    'Wazobia FM Lagos',
    'mp4',
    'Radio',
    true,
    'AIM Group · official wazobiafm.com Lagos player (StreamGuys)'
  ),
  (
    'https://coolfmlagos969-atunwadigital.streamguys1.com/coolfmlagos969',
    'Cool FM Lagos',
    'mp4',
    'Radio',
    true,
    'AIM Group · official coolfm.ng Lagos player (StreamGuys)'
  ),
  (
    'https://nigeriainfofmlagos993-atunwadigital.streamguys1.com/nigeriainfofmlagos993',
    'Nigeria Info FM Lagos',
    'mp4',
    'Radio',
    true,
    'AIM Group · official nigeriainfo.fm Lagos player (StreamGuys)'
  ),
  (
    'https://peacefm-atunwadigital.streamguys1.com/peacefm',
    'Peace FM Ghana',
    'mp4',
    'Radio',
    true,
    'Despite Media · official peacefmonline.com/services/streaming (Atunwa/StreamGuys)'
  ),
  (
    'https://starrfm-atunwadigital.streamguys1.com/starrfm',
    'Starr FM Ghana',
    'mp4',
    'Radio',
    true,
    'Multimedia Group · official Atunwa/StreamGuys live endpoint'
  ),
  (
    'https://mainradiostreaming.zbc.co.zw:8020/national.mp3',
    'ZBC National FM',
    'mp4',
    'Radio',
    true,
    'Zimbabwe Broadcasting Corporation · official mainradiostreaming CDN (National FM)'
  )
ON CONFLICT (url) DO UPDATE SET
  title = EXCLUDED.title,
  format = EXCLUDED.format,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Re-affirm MBC radio heal URLs remain published (BroadWave server may reject HEAD; GET via /api/hls).
UPDATE public.admin_media_links
SET
  is_published = true,
  notes = 'Malawi Broadcasting Corporation · official mbc.mw BroadWave high stream (port 88) · relay via /api/hls for cleartext HTTP',
  updated_at = now()
WHERE url = 'http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1';

UPDATE public.admin_media_links
SET
  is_published = true,
  notes = 'Malawi Broadcasting Corporation · official mbc.mw BroadWave high stream (port 86) · relay via /api/hls for cleartext HTTP',
  updated_at = now()
WHERE url = 'http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1';
