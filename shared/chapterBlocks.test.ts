import { describe, it, expect } from "vitest";
import type { PRDMode } from "./types";
import {
  CHAPTER_BLOCKS,
  STANDARD_TEMPLATES,
  getChapterBlock,
  MAX_CUSTOM_BLOCKS,
} from "./chapterBlocks";

// The canonical order is part of this registry's public contract.
const EXPECTED_BLOCK_IDS = [
  "overview",
  "problem-market",
  "feature-scope",
  "out-of-scope",
  "feature-spec",
  "user-stories",
  "ux-journey",
  "architecture",
  "data-models",
  "api-contracts",
  "frontend-arch",
  "nfr",
  "success-metrics",
  "gtm",
  "risks",
  "timeline",
  "compliance",
  "testing",
  "error-handling",
  "ai-agent-guidelines",
  "open-questions",
];

describe("CHAPTER_BLOCKS", () => {
  it("contains exactly 21 blocks", () => {
    expect(CHAPTER_BLOCKS).toHaveLength(21);
  });

  it("has unique ids", () => {
    const ids = CHAPTER_BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves the canonical id order", () => {
    expect(CHAPTER_BLOCKS.map((block) => block.id)).toEqual(EXPECTED_BLOCK_IDS);
  });

  it("has non-empty string fields and a valid category on every block", () => {
    for (const block of CHAPTER_BLOCKS) {
      const textFields = [
        block.id,
        block.titleEn,
        block.titleId,
        block.descEn,
        block.descId,
        block.icon,
      ];
      for (const field of textFields) {
        expect(typeof field).toBe("string");
        expect(field.trim().length).toBeGreaterThan(0);
      }
      expect(["product", "technical"]).toContain(block.category);
    }
  });
});

describe("STANDARD_TEMPLATES", () => {
  it("defines templates for every PRDMode", () => {
    expect(Object.keys(STANDARD_TEMPLATES).sort()).toEqual([
      "business",
      "simple",
      "technical",
    ]);
  });

  it.each([
    ["business", 12],
    ["simple", 6],
    ["technical", 9],
  ] as Array<[PRDMode, number]>)(
    "%s template has exactly %d block ids",
    (mode, length) => {
      expect(STANDARD_TEMPLATES[mode]).toHaveLength(length);
    }
  );

  it("only references valid block ids without duplicates", () => {
    for (const ids of Object.values(STANDARD_TEMPLATES)) {
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(getChapterBlock(id)).toBeDefined();
      }
    }
  });
});

describe("getChapterBlock", () => {
  it("returns the matching block for a valid id", () => {
    const block = getChapterBlock("overview");
    expect(block).toBeDefined();
    expect(block?.id).toBe("overview");
    expect(block?.titleEn).toBe("Executive Summary & Value Proposition");
  });

  it("returns undefined for unknown or empty ids", () => {
    expect(getChapterBlock("does-not-exist")).toBeUndefined();
    expect(getChapterBlock("")).toBeUndefined();
  });
});

describe("MAX_CUSTOM_BLOCKS", () => {
  it("equals 15", () => {
    expect(MAX_CUSTOM_BLOCKS).toBe(15);
  });
});
