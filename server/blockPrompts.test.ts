import { describe, it, expect } from "vitest";
import { CHAPTER_BLOCKS, MAX_CUSTOM_BLOCKS } from "../shared/chapterBlocks";
import { getSystemPrompt } from "./prompts";
import {
  getBlockInstructions,
  composeCustomSystemPrompt,
  validateCustomChapterIds,
  getCustomGuard,
} from "./blockPrompts";

// ---------------------------------------------------------------------------
// getBlockInstructions
// ---------------------------------------------------------------------------
describe("getBlockInstructions", () => {
  it("returns non-empty string for every known block in both languages", () => {
    for (const block of CHAPTER_BLOCKS) {
      for (const lang of ["en", "id"] as const) {
        const instr = getBlockInstructions(block.id, lang);
        expect(instr, `${block.id}/${lang}`).toBeTruthy();
        expect(typeof instr).toBe("string");
        expect(instr!.length).toBeGreaterThan(20);
      }
    }
  });

  it("returns null for unknown id", () => {
    expect(getBlockInstructions("does-not-exist", "en")).toBeNull();
    expect(getBlockInstructions("", "id")).toBeNull();
  });

  it("feature-scope en contains MoSCoW and WBS H3", () => {
    const instr = getBlockInstructions("feature-scope", "en")!;
    expect(instr).toContain("MoSCoW");
    expect(instr).toContain("### Feature Breakdown (WBS)");
  });

  it("feature-scope id contains WBS H3", () => {
    expect(getBlockInstructions("feature-scope", "id")!).toContain(
      "### Feature Breakdown (WBS)",
    );
  });

  it("user-stories contains Given/When/Then", () => {
    expect(getBlockInstructions("user-stories", "en")!).toContain("Given/When/Then");
  });

  it("ux-journey contains Mermaid journey", () => {
    expect(getBlockInstructions("ux-journey", "en")!).toContain("mermaid journey");
  });

  it("data-models contains erDiagram", () => {
    expect(getBlockInstructions("data-models", "en")!).toContain("erDiagram");
  });

  it("architecture contains graph TD", () => {
    expect(getBlockInstructions("architecture", "en")!).toContain("graph TD");
  });

  it("timeline contains gantt", () => {
    expect(getBlockInstructions("timeline", "en")!).toContain("gantt");
  });

  it("api-contracts contains JSON and error codes", () => {
    const instr = getBlockInstructions("api-contracts", "en")!;
    expect(instr).toContain("json");
    expect(instr).toContain("400");
    expect(instr).toMatch(/401|403/);
  });
});

// ---------------------------------------------------------------------------
// composeCustomSystemPrompt
// ---------------------------------------------------------------------------
describe("composeCustomSystemPrompt", () => {
  it("numbers headings sequentially and uses correct titles per language", () => {
    const ids = ["overview", "feature-scope", "timeline"];
    const en = composeCustomSystemPrompt(ids, "en");
    expect(en).toContain("## 1. Executive Summary & Value Proposition");
    expect(en).toContain("## 2. Solution Overview & Scope (MoSCoW)");
    expect(en).toContain("## 3. Project Timeline & Roadmap");

    const id = composeCustomSystemPrompt(ids, "id");
    expect(id).toContain("## 1. Ringkasan Eksekutif & Proposisi Nilai");
    expect(id).toContain("## 2. Ringkasan Solusi & Cakupan (MoSCoW)");
    expect(id).toContain("## 3. Linimasa Proyek & Roadmap");
  });

  it("preserves input order", () => {
    const ids = ["timeline", "overview", "risks"];
    const prompt = composeCustomSystemPrompt(ids, "en");
    const idx1 = prompt.indexOf("## 1. Project Timeline");
    const idx2 = prompt.indexOf("## 2. Executive Summary");
    const idx3 = prompt.indexOf("## 3. Risk Register");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx3).toBeGreaterThan(idx2);
  });

  it("contains WBS H3 when feature-scope selected", () => {
    const prompt = composeCustomSystemPrompt(["feature-scope", "overview"], "en");
    expect(prompt).toContain("### Feature Breakdown (WBS)");
  });

  it("closing directive reflects exact count", () => {
    const prompt = composeCustomSystemPrompt(["overview", "nfr"], "en");
    expect(prompt).toContain("ALL 2 chapters");
  });

  it("throws for empty array", () => {
    expect(() => composeCustomSystemPrompt([], "en")).toThrow();
  });

  it("throws for duplicate ids", () => {
    expect(() => composeCustomSystemPrompt(["overview", "overview"], "en")).toThrow(/Duplicate/i);
  });

  it("throws for unknown id", () => {
    expect(() => composeCustomSystemPrompt(["overview", "nope"], "en")).toThrow(/Unknown/i);
  });

  it("throws for > MAX_CUSTOM_BLOCKS", () => {
    const ids = CHAPTER_BLOCKS.slice(0, MAX_CUSTOM_BLOCKS + 1).map((b) => b.id);
    expect(() => composeCustomSystemPrompt(ids, "en")).toThrow();
  });

  it("is deterministic", () => {
    const ids = ["overview", "risks", "timeline"];
    expect(composeCustomSystemPrompt(ids, "en")).toBe(composeCustomSystemPrompt(ids, "en"));
  });

  it("is pure — does not mutate input", () => {
    const ids = ["overview", "timeline"];
    const copy = [...ids];
    composeCustomSystemPrompt(ids, "en");
    expect(ids).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// validateCustomChapterIds
// ---------------------------------------------------------------------------
describe("validateCustomChapterIds", () => {
  it("accepts valid ids", () => {
    const r = validateCustomChapterIds(["overview", "timeline"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ids).toEqual(["overview", "timeline"]);
  });

  it("accepts single id", () => {
    expect(validateCustomChapterIds(["overview"])).toEqual({ ok: true, ids: ["overview"] });
  });

  it("accepts exactly MAX_CUSTOM_BLOCKS", () => {
    const ids = CHAPTER_BLOCKS.slice(0, MAX_CUSTOM_BLOCKS).map((b) => b.id);
    const r = validateCustomChapterIds(ids);
    expect(r.ok).toBe(true);
  });

  it("rejects non-array", () => {
    expect(validateCustomChapterIds("overview").ok).toBe(false);
    expect(validateCustomChapterIds(null).ok).toBe(false);
    expect(validateCustomChapterIds(undefined).ok).toBe(false);
    expect(validateCustomChapterIds({}).ok).toBe(false);
  });

  it("rejects empty array", () => {
    const r = validateCustomChapterIds([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/at least 1/i);
  });

  it("rejects > MAX_CUSTOM_BLOCKS", () => {
    const ids = CHAPTER_BLOCKS.slice(0, MAX_CUSTOM_BLOCKS + 1).map((b) => b.id);
    // Need 16 ids but we only have 21 blocks — use duplicates padded to exceed via valid ids
    // Instead build 16 unique ids by adding synthetic valid ones; we have 21 so slice 16 works
    const many = CHAPTER_BLOCKS.slice(0, 16).map((b) => b.id);
    const r = validateCustomChapterIds(many);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/at most/i);
    // Also test via the variable
    expect(ids.length).toBeGreaterThan(MAX_CUSTOM_BLOCKS);
  });

  it("rejects duplicate ids", () => {
    const r = validateCustomChapterIds(["overview", "overview"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Duplicate/i);
  });

  it("rejects unknown id", () => {
    const r = validateCustomChapterIds(["overview", "not-a-block"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Unknown/i);
  });

  it("rejects non-string entries", () => {
    expect(validateCustomChapterIds([123 as unknown as string]).ok).toBe(false);
    expect(validateCustomChapterIds(["" as unknown as string]).ok).toBe(false);
  });

  it("reason is actionable English", () => {
    const r = validateCustomChapterIds([]);
    if (!r.ok) {
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------
// getCustomGuard
// ---------------------------------------------------------------------------
describe("getCustomGuard", () => {
  it("revision guard mentions chapter count and preserves structure", () => {
    const guard = getCustomGuard(["overview", "timeline"], "en", "revision");
    expect(guard).toContain("2 chapters");
    expect(guard).toContain("Do NOT add or remove");
  });

  it("append guard mentions chapter count", () => {
    const guard = getCustomGuard(["overview", "nfr", "risks"], "id", "append");
    expect(guard).toContain("3 chapter");
  });
});

// ---------------------------------------------------------------------------
// Legacy smoke: getSystemPrompt unchanged for 3 modes × 2 languages
// Captures structural invariants (heading counts, WBS, markers) without
// pinning exact prose — ensures zero behavior diff for standard modes.
// ---------------------------------------------------------------------------
describe("legacy getSystemPrompt smoke", () => {
  const modes: Array<"business" | "simple" | "technical"> = ["business", "simple", "technical"];
  const langs = ["en", "id"] as const;

  it.each(modes)("mode %s generates without throwing for both languages", (mode) => {
    for (const lang of langs) {
      expect(() => getSystemPrompt(lang, "", "", mode)).not.toThrow();
      const out = getSystemPrompt(lang, "", "", mode);
      expect(out.length).toBeGreaterThan(500);
    }
  });

  it("business has 12 chapters + WBS", () => {
    const en = getSystemPrompt("en", "", "", "business");
    // 12 chapter headings
    const count = (en.match(/^## \d+\./gm) || []).length;
    expect(count).toBe(12);
    expect(en).toContain("### Feature Breakdown (WBS)");
  });

  it("simple has 6 chapters + WBS", () => {
    const en = getSystemPrompt("en", "", "", "simple");
    const count = (en.match(/^## \d+\./gm) || []).length;
    expect(count).toBe(6);
    expect(en).toContain("### Feature Breakdown (WBS)");
  });

  it("technical has 9 chapters + WBS", () => {
    const en = getSystemPrompt("en", "", "", "technical");
    const count = (en.match(/^## \d+\./gm) || []).length;
    expect(count).toBe(9);
    expect(en).toContain("### Feature Breakdown (WBS)");
  });

  it("language switching changes output", () => {
    for (const mode of modes) {
      const en = getSystemPrompt("en", "", "", mode);
      const id = getSystemPrompt("id", "", "", mode);
      expect(en).not.toBe(id);
    }
  });
});
