import { describe, expect, it } from "vitest";
import {
  firstHlsResource,
  looksLikePlayableMedia,
  nextPlaylistHealth,
  playlistHealthRank,
} from "./playlist-health";

describe("private playlist health", () => {
  const checkedAt = new Date("2026-07-16T00:00:00.000Z");

  it("requires three consecutive failures before becoming unavailable", () => {
    expect(nextPlaylistHealth(false, 0, 900, checkedAt).health_status).toBe(
      "degraded",
    );
    expect(nextPlaylistHealth(false, 1, 900, checkedAt).health_status).toBe(
      "degraded",
    );
    const third = nextPlaylistHealth(false, 2, 900, checkedAt);
    expect(third.health_status).toBe("unavailable");
    expect(third.quarantined_at).toBe(checkedAt.toISOString());
  });

  it("recovers immediately after a successful check", () => {
    const recovered = nextPlaylistHealth(true, 7, 800, checkedAt);
    expect(recovered).toMatchObject({
      health_status: "healthy",
      fail_count: 0,
      quarantined_at: null,
      quarantine_reason: null,
      last_ok_at: checkedAt.toISOString(),
    });
  });

  it("orders healthy mirrors before unavailable mirrors", () => {
    expect(
      ["unavailable", "unknown", "healthy", "degraded"].sort(
        (a, b) => playlistHealthRank(a) - playlistHealthRank(b),
      ),
    ).toEqual(["healthy", "degraded", "unknown", "unavailable"]);
  });

  it("resolves the first HLS variant or media segment", () => {
    expect(
      firstHlsResource(
        "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nlow/index.m3u8",
        "https://media.example/live/master.m3u8",
      ),
    ).toBe("https://media.example/live/low/index.m3u8");
  });

  it("rejects empty transport-stream placeholders", () => {
    expect(looksLikePlayableMedia(Buffer.alloc(188, 0x47))).toBe(false);
    expect(looksLikePlayableMedia(Buffer.alloc(8_192, 0x47))).toBe(true);
    const mp4 = Buffer.alloc(8_192);
    mp4.write("ftyp", 4, "latin1");
    expect(looksLikePlayableMedia(mp4)).toBe(true);
  });
});
