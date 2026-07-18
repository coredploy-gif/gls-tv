import { describe, expect, it } from "vitest";
import { healChannelSources } from "@/lib/channel-heal";
import {
  healTraceSources,
  isCanonicalTraceUrban,
  isTraceChannel,
  primaryTraceHealUrl,
  TRACE_URBAN_FALLBACK_TAG,
  usesTraceUrbanFallback,
} from "@/lib/trace-mirrors";

const DEAD_GOSPEL_SA =
  "https://channels.trace.plus/Traceprod/GOSPEL_SA_hd/index.m3u8";
const DEAD_URBAN_SA =
  "https://channels.trace.plus/Traceprod/URBAN_SA_hd/index.m3u8";
const OWN_REGIONAL =
  "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00520-tcl-tracelatina-tcl/playlist.m3u8";

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
      expect(tags).toEqual(
        expect.arrayContaining([
          "Healed",
          "Playable",
          TRACE_URBAN_FALLBACK_TAG,
        ]),
      );
    }
  });
});

describe("Trace Urban own feed vs Urban sister fallback", () => {
  it("treats plain / international / france Urban as canonical (no switch notice)", () => {
    expect(isCanonicalTraceUrban("trace-urban", "Trace Urban")).toBe(true);
    expect(
      isCanonicalTraceUrban("trace-urban-international", "Trace Urban International"),
    ).toBe(true);
    expect(
      isCanonicalTraceUrban("trace-urban-france", "Trace Urban France"),
    ).toBe(true);
    expect(usesTraceUrbanFallback("trace-urban", "Trace Urban")).toBe(false);
  });

  it("flags Southern Africa / Africa Urban / Trace Africa / Gospel as Urban fallback", () => {
    expect(
      usesTraceUrbanFallback("trace-urban-sa", "Trace Urban Southern Africa"),
    ).toBe(true);
    expect(
      usesTraceUrbanFallback("trace-urban-africa", "Trace Urban Africa"),
    ).toBe(true);
    expect(usesTraceUrbanFallback("trace-africa", "Trace Africa")).toBe(true);
    expect(
      usesTraceUrbanFallback(
        "tracegospel-fr-southernafrica",
        "Trace Gospel Southern Africa",
      ),
    ).toBe(true);
    expect(usesTraceUrbanFallback("trace-latina", "Trace Latina")).toBe(false);
  });

  it("prefers a working own https feed ahead of Urban Amagi for regional Trace", () => {
    const healed = healTraceSources(
      "trace-urban-sa",
      "Trace Urban Southern Africa",
      [
        { url: DEAD_URBAN_SA, quality: "HD", format: "hls" },
        { url: OWN_REGIONAL, quality: "HD", format: "hls", label: "own" },
      ],
    );
    expect(healed[0]?.url).toBe(OWN_REGIONAL);
    expect(healed.some((s) => s.url.includes("traceurban"))).toBe(true);
    expect(healed.some((s) => s.url === DEAD_URBAN_SA)).toBe(true);
  });

  it("tags playlist Urban SA heal with TraceUrbanFallback", () => {
    const { tags, sources } = healChannelSources({
      slug: "trace-urban-sa",
      title: "Trace Urban Southern Africa",
      sources: [{ url: DEAD_URBAN_SA, quality: "HD", format: "hls" }],
      categories: ["Music"],
    });
    expect(sources[0]?.url).toContain("traceurban");
    expect(tags).toEqual(
      expect.arrayContaining([
        "Healed",
        "Playable",
        TRACE_URBAN_FALLBACK_TAG,
      ]),
    );
  });
});
