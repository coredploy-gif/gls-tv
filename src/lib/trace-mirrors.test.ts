import { describe, expect, it } from "vitest";
import { healChannelSources } from "@/lib/channel-heal";
import {
  healTraceSources,
  isTraceChannel,
  primaryTraceHealUrl,
} from "@/lib/trace-mirrors";

const DEAD_GOSPEL_SA =
  "https://channels.trace.plus/Traceprod/GOSPEL_SA_hd/index.m3u8";

describe("Trace Gospel concatenated iptv-org slugs", () => {
  it("detects tracegospel-* as Trace even without a title", () => {
    expect(isTraceChannel("tracegospel-fr-southernafrica")).toBe(true);
    expect(isTraceChannel("tracegospel-fr-sd")).toBe(true);
    expect(
      isTraceChannel("tracegospel-fr-nigeriaandeastafrica"),
    ).toBe(true);
    expect(isTraceChannel("trace-gospel", "Trace Gospel")).toBe(true);
  });

  it("heals Southern Africa Gospel onto Amagi before Trace+", () => {
    const healed = healTraceSources(
      "tracegospel-fr-southernafrica",
      "Trace Gospel Southern Africa",
      [{ url: DEAD_GOSPEL_SA, quality: "HD", format: "hls" }],
    );
    expect(healed[0]?.url).toContain("amagi.tv");
    expect(healed.some((s) => s.url === DEAD_GOSPEL_SA)).toBe(true);
    expect(primaryTraceHealUrl("tracegospel-fr-southernafrica")).toContain(
      "amg00520-tcl-traceurban",
    );
  });

  it("public healChannelSources applies override + Trace Amagi for gospel FR", () => {
    for (const slug of [
      "tracegospel-fr-southernafrica",
      "tracegospel-fr-sd",
      "tracegospel-fr-nigeriaandeastafrica",
    ]) {
      const { sources, tags } = healChannelSources({
        slug,
        title: "Trace Gospel",
        sources: [{ url: DEAD_GOSPEL_SA, quality: "HD", format: "hls" }],
        categories: ["Music", "Religious"],
      });
      expect(sources[0]?.url).toContain("amagi.tv");
      expect(tags).toEqual(expect.arrayContaining(["Healed", "Playable"]));
    }
  });
});
