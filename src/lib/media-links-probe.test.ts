import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

const secureFetchBuffered = vi.fn();
const validatePublicUrl = vi.fn();

vi.mock("@/lib/secure-url", () => ({
  secureFetchBuffered: (...args: unknown[]) => secureFetchBuffered(...args),
  validatePublicUrl: (...args: unknown[]) => validatePublicUrl(...args),
}));

import {
  probeMediaLinkReachability,
  resolveTrustedAppMediaFilePath,
} from "./media-links-probe";

/** Minimal ISO BMFF with `ftyp` so formatFromMediaMagic returns mp4. */
const MINI_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x01, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31,
]);

const GATEWAY = "http://103.253.18.58:8000/play/a03o";

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
    expect(secureFetchBuffered).not.toHaveBeenCalled();
  });

  it("still returns the SSRF error for arbitrary private IPs", async () => {
    // Bypass skip path (not an IPTV / .m3u8 URL) — fetch throws reserved-network.
    secureFetchBuffered.mockRejectedValueOnce(
      new Error("Private or reserved network targets are blocked"),
    );
    const probe = await probeMediaLinkReachability(
      "http://10.0.0.5/clip.mp4",
      "mp4",
    );
    expect(probe.ok).toBe(false);
    expect(probe.detail).toMatch(/Private or reserved network targets are blocked/);
  });

  it("rejects loopback HLS that is not trusted app media", async () => {
    secureFetchBuffered.mockClear();
    secureFetchBuffered.mockRejectedValueOnce(
      new Error("Private or reserved network targets are blocked"),
    );
    const probe = await probeMediaLinkReachability(
      "http://127.0.0.1/live/index.m3u8",
      "hls",
    );
    expect(probe.ok).toBe(false);
    expect(probe.detail).toMatch(
      /Private or reserved|Host is not allowed|localhost/i,
    );
    expect(secureFetchBuffered).toHaveBeenCalled();
  });
});

describe("media-links-probe IPTV gateway skip", () => {
  it("does not buffer /play/ gateway bodies", async () => {
    secureFetchBuffered.mockClear();
    validatePublicUrl.mockReset().mockResolvedValue({});

    const probe = await probeMediaLinkReachability(GATEWAY, "hls");

    expect(probe.ok).toBe(true);
    expect(probe.format).toBe("mpegts");
    expect(probe.detail).toMatch(/body probe skipped/i);
    expect(secureFetchBuffered).not.toHaveBeenCalled();
    expect(validatePublicUrl).toHaveBeenCalledWith(GATEWAY);
  });

  it("fetches and validates individual .m3u8 manifests", async () => {
    secureFetchBuffered.mockClear();
    secureFetchBuffered.mockResolvedValueOnce({
      status: 404,
      body: Buffer.from("not found"),
      headers: { "content-type": "text/plain" },
      finalUrl: "http://40.160.24.55/TSN_5/index.m3u8",
    });
    const stream = "http://40.160.24.55/TSN_5/index.m3u8";

    const probe = await probeMediaLinkReachability(stream, "hls");

    expect(probe.ok).toBe(false);
    expect(probe.status).toBe("dead");
    expect(probe.detail).toMatch(/HTTP 404/);
    expect(secureFetchBuffered).toHaveBeenCalledWith(
      stream,
      expect.objectContaining({ maxBytes: 64_000 }),
    );
  });
});
