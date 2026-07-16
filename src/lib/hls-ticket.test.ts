import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueHlsTicket, verifyHlsTicket } from "./hls-ticket";

describe("HLS relay tickets", () => {
  const previous = process.env.HLS_SIGNING_SECRET;

  beforeEach(() => {
    process.env.HLS_SIGNING_SECRET = "test-only-signing-secret";
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.HLS_SIGNING_SECRET;
    else process.env.HLS_SIGNING_SECRET = previous;
  });

  it("accepts an unchanged owner-scoped target", () => {
    const now = Date.UTC(2026, 6, 16);
    const ticket = issueHlsTicket(
      "channel-1",
      "https://media.example/live/segment.ts",
      "viewer-session",
      now,
    );
    expect(ticket).not.toBeNull();
    expect(
      verifyHlsTicket(
        "channel-1",
        "https://media.example/live/segment.ts",
        ticket!.expiresAt,
        ticket!.signature,
        "viewer-session",
        now + 60_000,
      ),
    ).toBe(true);
  });

  it("rejects modified targets, channels, sessions, and expired tickets", () => {
    const now = Date.UTC(2026, 6, 16);
    const target = "https://media.example/live/segment.ts";
    const ticket = issueHlsTicket("channel-1", target, "viewer-session", now)!;

    expect(
      verifyHlsTicket(
        "channel-1",
        `${target}?changed=1`,
        ticket.expiresAt,
        ticket.signature,
        "viewer-session",
        now,
      ),
    ).toBe(false);
    expect(
      verifyHlsTicket(
        "channel-2",
        target,
        ticket.expiresAt,
        ticket.signature,
        "viewer-session",
        now,
      ),
    ).toBe(false);
    expect(
      verifyHlsTicket(
        "channel-1",
        target,
        ticket.expiresAt,
        ticket.signature,
        "another-session",
        now,
      ),
    ).toBe(false);
    expect(
      verifyHlsTicket(
        "channel-1",
        target,
        ticket.expiresAt,
        ticket.signature,
        "viewer-session",
        (ticket.expiresAt + 1) * 1000,
      ),
    ).toBe(false);
  });
});
