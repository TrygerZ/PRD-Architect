import { describe, it, expect } from "vitest";
import { capState, isValidVersion, MAX_PERSISTED_VERSIONS } from "./persistence";
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
