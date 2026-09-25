import { describe, it, expect, vi } from "vitest";
import {
  capState,
  capVersions,
  createSyncChannel,
  isValidVersion,
  MAX_PERSISTED_VERSIONS,
  SYNC_CHANNEL_NAME,
} from "./persistence";
import type { PersistedState } from "./persistence";
import type { PRDVersion } from "../types";

function mkVersion(id: string, timestamp = Number(id)): PRDVersion {
  return { id, timestamp, content: "c", prompt: "p", productType: "Unknown" };
}

function mkState(partial: Partial<PersistedState>): PersistedState {
  return {
    versions: [],
    commentsByVersion: {},
    activeVersionId: null,
    savedAt: 0,
    ...partial,
  };
}

describe("isValidVersion", () => {
  it("accepts a well-formed version", () => {
    expect(isValidVersion(mkVersion("1"))).toBe(true);
  });

  it("rejects malformed entries", () => {
    expect(isValidVersion(null)).toBe(false);
    expect(isValidVersion({ id: 1, content: "x", timestamp: 0 })).toBe(false);
    expect(isValidVersion({ id: "1", content: 2, timestamp: 0 })).toBe(false);
    expect(isValidVersion({ id: "1", content: "x" })).toBe(false);
  });
});

describe("capVersions", () => {
  it("returns all versions when array length < limit", () => {
    const versions = [mkVersion("1"), mkVersion("2"), mkVersion("3")];
    const out = capVersions(versions, "2", 5);
    expect(out.map((v) => v.id)).toEqual(["1", "2", "3"]);
  });

  it("returns all versions when array length === limit", () => {
    const versions = [mkVersion("1"), mkVersion("2"), mkVersion("3")];
    const out = capVersions(versions, "1", 3);
    expect(out.map((v) => v.id)).toEqual(["1", "2", "3"]);
  });

  it("trims oldest versions when array length > limit and active is null", () => {
    const versions = [mkVersion("1"), mkVersion("2"), mkVersion("3"), mkVersion("4")];
    const out = capVersions(versions, null, 2);
    expect(out.map((v) => v.id)).toEqual(["3", "4"]);
  });

  it("retains active version when active is outside the window (older than window)", () => {
    const versions = [mkVersion("1"), mkVersion("2"), mkVersion("3"), mkVersion("4")];
    const out = capVersions(versions, "1", 2);
    expect(out).toHaveLength(2);
    expect(out.map((v) => v.id)).toEqual(["1", "4"]);
  });

  it("retains active version when active is inside the window", () => {
    const versions = [mkVersion("1"), mkVersion("2"), mkVersion("3"), mkVersion("4")];
    const out = capVersions(versions, "3", 2);
    expect(out.map((v) => v.id)).toEqual(["3", "4"]);
  });

  it("trims normally when active version id does not exist in array", () => {
    const versions = [mkVersion("1"), mkVersion("2"), mkVersion("3"), mkVersion("4")];
    const out = capVersions(versions, "999", 2);
    expect(out.map((v) => v.id)).toEqual(["3", "4"]);
  });

  it("filters out invalid versions before capping", () => {
    const versions = [
      mkVersion("1"),
      { id: "invalid" } as unknown as PRDVersion,
      mkVersion("2"),
      mkVersion("3"),
    ];
    const out = capVersions(versions, "2", 2);
    expect(out.map((v) => v.id)).toEqual(["2", "3"]);
  });

  it("uses MAX_PERSISTED_VERSIONS as default limit", () => {
    const versions = Array.from({ length: MAX_PERSISTED_VERSIONS + 10 }, (_, i) =>
      mkVersion(String(i + 1)),
    );
    const out = capVersions(versions, null);
    expect(out).toHaveLength(MAX_PERSISTED_VERSIONS);
    expect(out[0].id).toBe("11");
  });
});

describe("capState", () => {
  it("filters invalid versions", () => {
    const versions = [mkVersion("1"), { id: "2" } as unknown as PRDVersion, mkVersion("3")];
    const out = capState(mkState({ versions }));
    expect(out.versions.map((v) => v.id)).toEqual(["1", "3"]);
  });

  it("keeps only the newest N versions", () => {
    const versions = Array.from({ length: MAX_PERSISTED_VERSIONS + 10 }, (_, i) => mkVersion(String(i + 1)));
    const out = capState(mkState({ versions }));
    expect(out.versions).toHaveLength(MAX_PERSISTED_VERSIONS);
    expect(out.versions[0].id).toBe("11");
  });

  it("always retains the active version even if it would be trimmed", () => {
    const versions = Array.from({ length: MAX_PERSISTED_VERSIONS + 5 }, (_, i) => mkVersion(String(i + 1)));
    const out = capState(mkState({ versions, activeVersionId: "1" }));
    expect(out.versions).toHaveLength(MAX_PERSISTED_VERSIONS);
    expect(out.versions.some((v) => v.id === "1")).toBe(true);
  });

  it("drops orphan comments", () => {
    const out = capState(
      mkState({
        versions: [mkVersion("1")],
        commentsByVersion: { "1": { s: "keep" }, "99": { s: "orphan" } },
      }),
    );
    expect(out.commentsByVersion).toEqual({ "1": { s: "keep" } });
  });
});

describe("createSyncChannel", () => {
  it("returns null when BroadcastChannel is undefined", () => {
    const original = (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;
    delete (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;
    try {
      const channel = createSyncChannel();
      expect(channel).toBeNull();
    } finally {
      (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel = original;
    }
  });

  it("returns instance of BroadcastChannel with SYNC_CHANNEL_NAME when supported", () => {
    class MockBC {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
    }
    const original = (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as unknown as { BroadcastChannel: typeof MockBC }).BroadcastChannel = MockBC;
    try {
      const channel = createSyncChannel() as unknown as MockBC | null;
      expect(channel).toBeInstanceOf(MockBC);
      expect(channel?.name).toBe(SYNC_CHANNEL_NAME);
    } finally {
      (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel = original;
    }
  });
});

