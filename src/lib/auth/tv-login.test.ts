import { describe, expect, it } from "vitest";
import {
  formatUserCodeDisplay,
  generateUserCode,
  isValidUserCode,
  normalizeUserCode,
  resolveTvLoginStatus,
  tvPairPath,
} from "./tv-login";

describe("tv-login helpers", () => {
  it("normalizes and validates user codes", () => {
    expect(normalizeUserCode("abcd efgh")).toBe("ABCD-EFGH");
    expect(normalizeUserCode("ABCD-EFGH")).toBe("ABCD-EFGH");
    expect(normalizeUserCode("short")).toBe("");
    expect(isValidUserCode("ABCD-EFGH")).toBe(true);
    expect(isValidUserCode("ABCD0EFGH")).toBe(false);
    expect(isValidUserCode("abcd-efgh")).toBe(false);
  });

  it("formats display codes", () => {
    expect(formatUserCodeDisplay("wxyz1234")).toBe("WXYZ-1234");
  });

  it("generates XXXX-XXXX from random bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const code = generateUserCode(bytes);
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(isValidUserCode(code)).toBe(true);
  });

  it("builds pair path", () => {
    expect(tvPairPath("ABCD-EFGH")).toBe("/auth/tv-pair?code=ABCD-EFGH");
  });

  it("marks overdue pending as expired", () => {
    expect(
      resolveTvLoginStatus({
        status: "pending",
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
    ).toBe("expired");
    expect(
      resolveTvLoginStatus({
        status: "pending",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toBe("pending");
    expect(
      resolveTvLoginStatus({
        status: "approved",
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
    ).toBe("approved");
  });
});
