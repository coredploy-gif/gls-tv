import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

import {
  probeMediaLinkReachability,
  resolveTrustedAppMediaFilePath,
} from "./media-links-probe";

/** Minimal ISO BMFF with `ftyp` so formatFromMediaMagic returns mp4. */
const MINI_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x01, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31,
]);

describe("media-links-probe trusted app media", () => {
  const mediaDir = path.join(process.cwd(), "public", "media");
  const samplePath = path.join(mediaDir, "sample.mp4");
  let wroteSample = false;

  beforeAll(async () => {
    await fs.mkdir(mediaDir, { recursive: true });
    try {
      await fs.access(samplePath);
    } catch {
      await fs.writeFile(samplePath, MINI_MP4);
      wroteSample = true;
    }
  });

  afterAll(async () => {
    if (wroteSample) {
      await fs.unlink(samplePath).catch(() => undefined);
    }
  });

  it("resolves /media/sample.mp4 under public/ and blocks traversal", () => {
    const resolved = resolveTrustedAppMediaFilePath(
      "http://127.0.0.1:3010/media/sample.mp4",
    );
    expect(resolved).toBe(samplePath);
    expect(
      resolveTrustedAppMediaFilePath(
        "http://127.0.0.1:3010/media/../.env",
      ),
    ).toBeNull();
  });

  it("allows localhost /media/sample.mp4 via filesystem (no SSRF fetch)", async () => {
    const probe = await probeMediaLinkReachability(
      "http://127.0.0.1:3010/media/sample.mp4",
      "mp4",
      { requestOrigin: "http://127.0.0.1:3010" },
    );
    expect(probe.ok).toBe(true);
    expect(probe.status).toBe("active");
    expect(probe.format).toBe("mp4");
  });

  it("still returns the SSRF error for arbitrary private IPs", async () => {
    const probe = await probeMediaLinkReachability(
      "http://10.0.0.5/clip.mp4",
      "mp4",
    );
    expect(probe.ok).toBe(false);
    expect(probe.detail).toMatch(/Private or reserved network targets are blocked/);
  });

  it("rejects loopback HLS that is not trusted app media", async () => {
    const probe = await probeMediaLinkReachability(
      "http://127.0.0.1/live/index.m3u8",
      "hls",
    );
    expect(probe.ok).toBe(false);
    expect(probe.detail).toMatch(
      /Private or reserved|Host is not allowed|localhost/i,
    );
  });
});
