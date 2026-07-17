import { describe, expect, it } from "vitest";
import {
  directionalNavKey,
  isActivateKey,
  isDirectionalNavKey,
  readTvOverrideFromSearch,
} from "./tv-detect";

describe("tv-detect helpers", () => {
  it("reads tv=1 override from search strings", () => {
    expect(readTvOverrideFromSearch("?tv=1")).toBe(true);
    expect(readTvOverrideFromSearch("tv=1&next=/profiles")).toBe(true);
    expect(readTvOverrideFromSearch("?tv=0")).toBe(false);
    expect(readTvOverrideFromSearch("")).toBe(false);
    expect(readTvOverrideFromSearch(null)).toBe(false);
  });

  it("maps Android DPAD keyCodes to arrow directions", () => {
    const up = { key: "Unidentified", keyCode: 19 } as KeyboardEvent;
    const down = { key: "Unidentified", keyCode: 20 } as KeyboardEvent;
    const left = { key: "Unidentified", keyCode: 21 } as KeyboardEvent;
    const right = { key: "Unidentified", keyCode: 22 } as KeyboardEvent;
    expect(directionalNavKey(up)).toBe("ArrowUp");
    expect(directionalNavKey(down)).toBe("ArrowDown");
    expect(directionalNavKey(left)).toBe("ArrowLeft");
    expect(directionalNavKey(right)).toBe("ArrowRight");
    expect(isDirectionalNavKey(up)).toBe(true);
  });

  it("detects DPAD_CENTER / Enter as activate", () => {
    expect(isActivateKey({ key: "Enter", keyCode: 13 } as KeyboardEvent)).toBe(
      true,
    );
    expect(isActivateKey({ key: "Select", keyCode: 0 } as KeyboardEvent)).toBe(
      true,
    );
    expect(
      isActivateKey({ key: "Unidentified", keyCode: 23 } as KeyboardEvent),
    ).toBe(true);
  });
});
