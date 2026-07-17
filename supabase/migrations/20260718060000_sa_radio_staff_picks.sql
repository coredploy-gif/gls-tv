-- Seed curated South African radio stations as published staff picks (Radio category).
-- URLs verified against official StreamTheWorld / station CDN endpoints.

INSERT INTO public.admin_media_links (url, title, format, category, is_published, notes)
VALUES
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/METROFM.mp3',
    'Metro FM',
    'mp4',
    'Radio',
    true,
    'SABC urban contemporary · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/5FM.mp3',
    '5FM',
    'mp4',
    'Radio',
    true,
    'SABC youth hits · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/KFM.mp3',
    'KFM',
    'mp4',
    'Radio',
    true,
    'Primedia pop · Cape Town · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/RSG.mp3',
    'RSG',
    'mp4',
    'Radio',
    true,
    'SABC Afrikaans · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/SAFM.mp3',
    'SA FM',
    'mp4',
    'Radio',
    true,
    'SABC talk · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIO2000.mp3',
    'Radio 2000',
    'mp4',
    'Radio',
    true,
    'SABC adult contemporary · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/UKHOZIFM.mp3',
    'Ukhozi FM',
    'mp4',
    'Radio',
    true,
    'SABC isiZulu · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/LOTUSFM.mp3',
    'Lotus FM',
    'mp4',
    'Radio',
    true,
    'SABC Indian lifestyle · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/GOODHOPEFM.mp3',
    'Good Hope FM',
    'mp4',
    'Radio',
    true,
    'SABC Cape Town urban · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/TRUFM.mp3',
    'Tru FM',
    'mp4',
    'Radio',
    true,
    'SABC Eastern Cape · StreamTheWorld official redirect'
  ),
  (
    'https://playerservices.streamtheworld.com/api/livestream-redirect/LESEDI.mp3',
    'Lesedi FM',
    'mp4',
    'Radio',
    true,
    'SABC Sesotho · StreamTheWorld official redirect'
  ),
  (
    'https://livestream2.bokradio.co.za/hls/Bok5c.m3u8',
    'Bok Radio',
    'hls',
    'Radio',
    true,
    'Bokkomlaan community radio · official station HLS'
  ),
  (
    'http://radiostream.mbc.mw:88/broadwave.mp3?src=Radio1&rate=1',
    'MBC Radio 1',
    'mp4',
    'Radio',
    true,
    'Malawi Broadcasting Corporation · official BroadWave stream'
  ),
  (
    'http://radiostream.mbc.mw:88/broadwave.mp3?src=Radio2&rate=1',
    'MBC Radio 2',
    'mp4',
    'Radio',
    true,
    'Malawi Broadcasting Corporation · official BroadWave stream'
  )
ON CONFLICT (url) DO UPDATE SET
  title = EXCLUDED.title,
  format = EXCLUDED.format,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published,
  notes = EXCLUDED.notes,
  updated_at = now();
