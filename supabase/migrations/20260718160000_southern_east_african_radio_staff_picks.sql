-- Seed verified Southern & East African streams (probed HTTP 200, 2026-07-18).
-- Tanzania Clouds FM (FastCast official player) + DRC RTNC linear TV (rtnc.cd/direct).

INSERT INTO public.admin_media_links (url, title, format, category, is_published, notes)
VALUES
  (
    'http://eu6.fastcast4u.com:5306/',
    'Clouds FM Tanzania',
    'mp4',
    'Radio',
    true,
    'Clouds Media Group · official cloudsfm.co.tz FastCast stream (Dar es Salaam)'
  ),
  (
    'https://rtnc.cd/live/rtnclive.m3u8',
    'RTNC (DRC)',
    'hls',
    'Live TV',
    true,
    'Radio Télévision Nationale Congolaise · official rtnc.cd/direct HLS (Kinshasa)'
  )
ON CONFLICT (url) DO UPDATE SET
  title = EXCLUDED.title,
  format = EXCLUDED.format,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Re-affirm MBC radio heals (BroadWave may reject HEAD; relay via /api/hls).
UPDATE public.admin_media_links
SET
  is_published = true,
  notes = 'Malawi Broadcasting Corporation · official mbc.mw BroadWave high stream (port 88) · intermittent from some regions · relay via /api/hls',
  updated_at = now()
WHERE url = 'http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1';

UPDATE public.admin_media_links
SET
  is_published = true,
  notes = 'Malawi Broadcasting Corporation · official mbc.mw BroadWave high stream (port 86) · intermittent from some regions · relay via /api/hls',
  updated_at = now()
WHERE url = 'http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1';
