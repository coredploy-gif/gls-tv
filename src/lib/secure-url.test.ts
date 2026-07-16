import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { isReservedAddress, readStreamBuffered } from "./secure-url";

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

  it("stops buffering when a streamed response exceeds its byte limit", async () => {
    const stream = Readable.from([Buffer.alloc(8), Buffer.alloc(8)]);
    await expect(readStreamBuffered(stream, 12)).rejects.toThrow(
      "Upstream response is too large",
    );
  });
});
