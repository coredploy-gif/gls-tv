import { describe, expect, it } from "vitest";
import { buildPlaybackMetric } from "./playback-telemetry";

describe("playback telemetry", () => {
  it("keeps metrics bounded and excludes URLs", () => {
    expect(buildPlaybackMetric({ event: "startup", slug: "ESPN 8!?", durationMs: 999_999, sourceIndex: 90, mode: "other" })).toEqual({
      event: "startup",
      slug: "ESPN8",
      durationMs: 300_000,
      sourceIndex: 50,
      mode: "direct",
    });
  });
});
