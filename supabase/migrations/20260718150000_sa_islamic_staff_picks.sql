-- Seed verified South African Islamic radio as Religion staff picks (2026-07-18 probe).
-- TV: Deen Channel / ITV Networks / Hilaal TV — no public HLS found; skipped.

INSERT INTO public.admin_media_links (url, title, format, category, is_published, notes)
VALUES
  (
    'https://cast1.my-control-panel.com/proxy/netmoham/radioislam.mp3',
    'Radio Islam (South Africa)',
    'mp4',
    'Religion',
    true,
    'Radio Islam International · 1548 AM Johannesburg · official radioislam.org.za listen-live stream'
  ),
  (
    'https://edge.iono.fm/xice/109_medium.mp3',
    'Channel Islam International',
    'mp4',
    'Religion',
    true,
    'Cii Radio · English Islamic news & talk · official iono.fm stream (ciiradio.com)'
  )
ON CONFLICT (url) DO UPDATE SET
  title = EXCLUDED.title,
  format = EXCLUDED.format,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published,
  notes = EXCLUDED.notes,
  updated_at = now();
