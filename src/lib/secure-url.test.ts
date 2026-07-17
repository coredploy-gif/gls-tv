import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import {
  isReservedAddress,
  pinnedLookup,
  readStreamBuffered,
  validatePublicUrl,
} from "./secure-url";

describe("secure URL address checks", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "fd00::1",
    "2001:db8::1",
  ])("blocks reserved address %s", (address) => {
    expect(isReservedAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isReservedAddress(address)).toBe(false);
    },
  );

  it("blocks probing arbitrary private IP URLs", async () => {
    await expect(
      validatePublicUrl("http://10.0.0.5/secret.mp4"),
    ).rejects.toThrow(/Private or reserved network targets are blocked/);
    await expect(
      validatePublicUrl("http://169.254.169.254/latest/meta-data"),
    ).rejects.toThrow(/Private or reserved network targets are blocked/);
    await expect(
      validatePublicUrl("http://127.0.0.1/media/sample.mp4"),
    ).rejects.toThrow(/Private or reserved network targets are blocked/);
  });

  it("stops buffering when a streamed response exceeds its byte limit", async () => {
    const stream = Readable.from([Buffer.alloc(8), Buffer.alloc(8)]);
    await expect(readStreamBuffered(stream, 12)).rejects.toThrow(
      "Upstream response is too large",
    );
  });

  it("supports Node all:true lookup callbacks used by happy eyeballs", () => {
    const lookup = pinnedLookup([
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    const allCb = vi.fn();
    lookup("example.test", { all: true, hints: 0 }, allCb);
    expect(allCb).toHaveBeenCalledWith(null, [
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);

    const oneCb = vi.fn();
    lookup("example.test", { hints: 0 }, oneCb);
    expect(oneCb).toHaveBeenCalledWith(null, "1.1.1.1", 4);
  });
});
