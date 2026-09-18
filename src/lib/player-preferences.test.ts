import { describe, expect, it } from "vitest";
import { safePlayerVolume } from "./player-preferences";

describe("player preferences", () => {
  it("clamps persisted volume", () => {
    expect(safePlayerVolume(2)).toBe(1);
    expect(safePlayerVolume(-1)).toBe(0);
    expect(safePlayerVolume("0.65")).toBe(0.65);
  });

  it("uses a fallback for corrupt values", () => {
    expect(safePlayerVolume("nope", 0.8)).toBe(0.8);
  });
});
