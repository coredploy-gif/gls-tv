import { describe, expect, it } from "vitest";
import {
  pathNeedsViewer,
  profilesGateHref,
  redirectAfterViewerPick,
} from "./access-paths";

describe("pathNeedsViewer", () => {
  it("gates playlists and browse", () => {
    expect(pathNeedsViewer("/playlists")).toBe(true);
    expect(pathNeedsViewer("/playlists/saved")).toBe(true);
    expect(pathNeedsViewer("/browse")).toBe(true);
    expect(pathNeedsViewer("/games")).toBe(true);
    expect(pathNeedsViewer("/radio")).toBe(true);
  });

  it("skips account and profiles", () => {
    expect(pathNeedsViewer("/profiles")).toBe(false);
    expect(pathNeedsViewer("/account")).toBe(false);
    expect(pathNeedsViewer("/billing")).toBe(false);
  });
});

describe("profilesGateHref", () => {
  it("preserves playlists as next", () => {
    expect(profilesGateHref("/playlists")).toBe("/profiles?next=%2Fplaylists");
    expect(profilesGateHref("/playlists", { reason: "device" })).toBe(
      "/profiles?reason=device&next=%2Fplaylists",
    );
  });

  it("does not nest profiles next", () => {
    expect(profilesGateHref("/profiles")).toBe("/profiles");
  });
});

describe("redirectAfterViewerPick", () => {
  it("returns next for playlists", () => {
    expect(redirectAfterViewerPick("/playlists", false)).toBe("/playlists");
    expect(redirectAfterViewerPick("/playlists/saved", true)).toBe(
      "/playlists/saved",
    );
  });

  it("falls back for kids/adults without next", () => {
    expect(redirectAfterViewerPick(null, false)).toBe("/browse");
    expect(redirectAfterViewerPick(null, true)).toBe("/kids");
    expect(redirectAfterViewerPick("/profiles", false)).toBe("/browse");
  });
});
