function Test-Stream([string]$Url) {
  try {
    $resp = Invoke-WebRequest -Uri $Url -Method Head -MaximumRedirection 5 -TimeoutSec 12 -UseBasicParsing -UserAgent "GLS-TV-Probe/1.0"
    return "$($resp.StatusCode)|$($resp.Headers['Content-Type'])"
  } catch {
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      if ($code -eq 405 -or $code -eq 403 -or $code -eq 501) {
        try {
          $resp2 = Invoke-WebRequest -Uri $Url -Method Get -MaximumRedirection 5 -TimeoutSec 12 -UseBasicParsing -UserAgent "GLS-TV-Probe/1.0"
          return "$($resp2.StatusCode)|$($resp2.Headers['Content-Type'])|get"
        } catch {
          if ($_.Exception.Response) { return "$([int]$_.Exception.Response.StatusCode)|get-error" }
        }
      }
      return "$code|head-error"
    }
    $msg = $_.Exception.Message
    if ($msg.Length -gt 55) { $msg = $msg.Substring(0, 55) }
    return "fail|$msg"
  }
}

$urls = @(
  # Heals
  'http://radiostream.mbc.mw:88/broadwavehigh.mp3?src=1',
  'http://radiostream.mbc.mw:86/broadwavehigh.mp3?src=1',
  'https://ice31.securenetsystems.net/0079',
  'https://glb.bozztv.com/glb/ssh101/kwacha/index.m3u8',
  'https://ssh101-fl.bozztv.com/ssh101/mbctv2mw/index.m3u8',
  'https://playerservices.streamtheworld.com/api/livestream-redirect/METROFM.mp3',
  'https://playerservices.streamtheworld.com/api/livestream-redirect/5FM.mp3',
  'https://atunwadigital.streamguys1.com/capitalfm',
  'https://coolfmlagos969-atunwadigital.streamguys1.com/coolfmlagos969',
  'https://peacefm-atunwadigital.streamguys1.com/peacefm',
  'https://mainradiostreaming.zbc.co.zw:8020/national.mp3',
  'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8',
  'https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8',
  # Tanzania
  'http://eu6.fastcast4u.com:5306/',
  'https://eu6.fastcast4u.com/proxy/cloudsfm?mp=/1',
  # Ethiopia TV (EBC partner CDN)
  'https://rrsatrtmp.tulix.tv/addis1/addis1multi.smil/playlist.m3u8',
  # Somalia state TV
  'https://ap02.iqplay.tv:8082/iqb8002/s4ne/playlist.m3u8',
  'https://ap02.iqplay.tv:8082/iqb8002/s2tve/playlist.m3u8',
  # DRC Radio Okapi (UN/official partner)
  'https://radio.okapi.org/radio.mp3',
  'https://stream.radio.co/s2e2dcb5c8/listen',
  # Lesotho zeno relays
  'https://stream.zeno.fm/0r0qx5k5hzzuv',
  'https://stream.zeno.fm/harvestfmlesotho',
  'https://stream.zeno.fm/radio-lesotho',
  # Botswana private official
  'https://ice42.securenetsystems.net/GABZFM',
  'https://ice31.securenetsystems.net/GABZFM',
  'https://playerservices.streamtheworld.com/api/livestream-redirect/GABZFM.mp3',
  # Zambia attempts
  'https://ice42.securenetsystems.net/ZNBC',
  'https://ice10.securenetsystems.net/ZNBC',
  'https://ice31.securenetsystems.net/ZNBCFM',
  # Congo Brazzaville RTV
  'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIOCONGOBRAZZA.mp3',
  'https://playerservices.streamtheworld.com/api/livestream-redirect/RTVCONGO.mp3'
)

foreach ($u in $urls) {
  Write-Host "$(Test-Stream $u) $u"
}
