-- Heal Malawi MBC radio (official broadwavehigh endpoints) and seed MBC TV staff picks.

UPDATE public.admin_media_links
SET
  is_published = false,
  notes = coalesce(notes, '') || ' · superseded by broadwavehigh heal 2026-07-18',
  updated_at = now()
WHERE url IN (
  'http://radiostream.mbc.mw:88/broadwave.mp3?src=Radio1&rate=1',
  'http://radiostream.mbc.mw:88/broadwave.mp3?src=Radio2&rate=1'
);

INSERT INTO public.admin_media_links (url, title, format, category, is_published, notes)
VALUES
  (
    'http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1',
    'MBC Radio 1',
    'mp4',
    'Radio',
    true,
    'Malawi Broadcasting Corporation · official mbc.mw BroadWave high stream (port 88)'
  ),
  (
    'http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1',
    'MBC Radio 2',
    'mp4',
    'Radio',
    true,
    'Malawi Broadcasting Corporation · official mbc.mw BroadWave high stream (port 86)'
  ),
  (
    'https://glb.bozztv.com/glb/ssh101/kwacha/index.m3u8',
    'MBC TV',
    'hls',
    'Live TV',
    true,
    'Malawi Broadcasting Corporation · official mbc.mw/live/tv1.html HLS'
  ),
  (
    'https://ssh101-fl.bozztv.com/ssh101/mbctv2mw/index.m3u8',
    'MBC TV 2',
    'hls',
    'Live TV',
    true,
    'Malawi Broadcasting Corporation · official mbc.mw/live/tv2.html HLS'
  )
ON CONFLICT (url) DO UPDATE SET
  title = EXCLUDED.title,
  format = EXCLUDED.format,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published,
  notes = EXCLUDED.notes,
  updated_at = now();
