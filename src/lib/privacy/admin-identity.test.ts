import { describe, expect, it } from "vitest";
import {
  OWNER_ADMIN_LABEL,
  PUBLIC_STAFF_LABEL,
  publicMessageAuthorLabel,
  publicPlayerDisplayName,
  redactProtectedEmail,
} from "@/lib/privacy/admin-identity";

describe("admin-identity privacy", () => {
  it("exposes Cassim only as the admin-console label constant", () => {
    expect(OWNER_ADMIN_LABEL).toBe("Cassim");
    expect(PUBLIC_STAFF_LABEL).toBe("GLS Support");
  });

  it("labels agent messages as GLS Support for members", () => {
    expect(
      publicMessageAuthorLabel({ authorType: "agent", authorEmail: "x@y.com" }),
    ).toBe("GLS Support");
    expect(
      publicMessageAuthorLabel({ authorType: "user", authorEmail: "a@b.com" }),
    ).toBeNull();
  });

  it("never uses email local-part style names when a display name exists", () => {
    expect(
      publicPlayerDisplayName({
        displayName: "Sam",
        email: "sam@example.com",
      }),
    ).toBe("Sam");
    expect(
      publicPlayerDisplayName({
        displayName: "sam@example.com",
        fallback: "Player",
      }),
    ).toBe("Player");
  });

  it("redacts only when helper is used with a protected check elsewhere", () => {
    // Without EADMIN_EMAILS in test env, ordinary emails pass through.
    expect(redactProtectedEmail("member@example.com")).toBe("member@example.com");
    expect(redactProtectedEmail(null)).toBeNull();
  });
});
