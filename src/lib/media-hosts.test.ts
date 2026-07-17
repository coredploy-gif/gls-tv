import { describe, expect, it } from "vitest";
import { isAllowedMediaHost } from "./media-hosts";

describe("isAllowedMediaHost", () => {
  it("allows jmp2 entry and Roku delivery redirect targets", () => {
    expect(isAllowedMediaHost("jmp2.uk")).toBe(true);
    expect(isAllowedMediaHost("aka-live1050.delivery.roku.com")).toBe(true);
    expect(isAllowedMediaHost("aka-live.delivery.roku.com")).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(isAllowedMediaHost("evil.example")).toBe(false);
    expect(isAllowedMediaHost("github.com")).toBe(false);
  });
});
