import { describe, expect, it } from "vitest";
import { castContentType } from "./google-cast";

describe("Google Cast media types", () => {
  it("uses receiver-compatible streaming MIME types", () => {
    expect(castContentType("hls")).toBe("application/x-mpegURL");
    expect(castContentType("dash")).toBe("application/dash+xml");
    expect(castContentType("mp4")).toBe("video/mp4");
  });
});
