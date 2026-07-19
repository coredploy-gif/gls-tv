import { describe, expect, it } from "vitest";
import {
  isWrongSabcSisterUrl,
  rememberStream,
  getStreamMemory,
  clearStreamMemory,
} from "./stream-memory";

describe("isWrongSabcSisterUrl", () => {
  it("flags News/LN24 stuck on SABC 1", () => {
    expect(
      isWrongSabcSisterUrl(
        "sabc-1",
        "https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8",
      ),
    ).toBe(true);
    expect(
      isWrongSabcSisterUrl(
        "sabc-1",
        "https://cdnstack.internetmultimediaonline.org/ln24/ln24.stream/playlist.m3u8",
      ),
    ).toBe(true);
  });

  it("allows real SABC 1 and SABC News itself", () => {
    expect(
      isWrongSabcSisterUrl(
        "sabc-1",
        "https://sabconeta.cdn.mangomolo.com/sabc1/smil:sabc1.stream.smil/master.m3u8",
      ),
    ).toBe(false);
    expect(
      isWrongSabcSisterUrl(
        "sabc-news",
        "https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8",
      ),
    ).toBe(false);
  });
});

describe("rememberStream sabc guard", () => {
  it("refuses to persist News URL under sabc-1", () => {
    clearStreamMemory("sabc-1");
    rememberStream(
      "sabc-1",
      "https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8",
      "direct",
    );
    expect(getStreamMemory("sabc-1")).toBeNull();
  });
});
