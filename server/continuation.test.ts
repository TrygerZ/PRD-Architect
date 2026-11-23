import { describe, it, expect } from "vitest";
import {
  MAX_CONTINUATIONS,
  maxContinuationsFor,
  extractFinishReason,
  isLengthTruncated,
  getExpectedChapterHeadings,
  countDetectedChapters,
  decideContinuation,
  prepareAssistantContext,
  buildContinuationMessages,
  stripContinuationOverlap,
  createSeamDeduplicator,
} from "./continuation";
import { CHAPTER_BLOCKS } from "../shared/chapterBlocks";

describe("server/continuation", () => {
  describe("extractFinishReason", () => {
    it("extracts OpenAI-compatible finish_reason", () => {
      expect(extractFinishReason({ choices: [{ finish_reason: "length" }] })).toBe("length");
      expect(extractFinishReason({ choices: [{ finish_reason: "stop" }] })).toBe("stop");
      expect(extractFinishReason({ choices: [{ finish_reason: null }] })).toBeNull();
      expect(extractFinishReason({ choices: [{ delta: { content: "hi" } }] })).toBeNull();
    });

    it("extracts Gemini native finishReason", () => {
      expect(extractFinishReason({ candidates: [{ finishReason: "MAX_TOKENS" }] })).toBe("MAX_TOKENS");
      expect(extractFinishReason({ candidates: [{ finishReason: "STOP" }] })).toBe("STOP");
      expect(extractFinishReason({ candidates: [{ finishReason: null }] })).toBeNull();
    });
  });

  describe("isLengthTruncated", () => {
    it("detects length-based finish reasons across providers case-insensitively", () => {
      expect(isLengthTruncated("length")).toBe(true);
      expect(isLengthTruncated("LENGTH")).toBe(true);
      expect(isLengthTruncated("MAX_TOKENS")).toBe(true);
      expect(isLengthTruncated("max_tokens")).toBe(true);
      expect(isLengthTruncated("max_output_tokens")).toBe(true);
    });

    it("returns false for normal stop or null", () => {
      expect(isLengthTruncated("stop")).toBe(false);
      expect(isLengthTruncated("STOP")).toBe(false);
      expect(isLengthTruncated(null)).toBe(false);
    });
  });

  describe("getExpectedChapterHeadings", () => {
    it("returns exact chapter counts for standard modes", () => {
      expect(getExpectedChapterHeadings("simple", "en", null)).toHaveLength(6);
      expect(getExpectedChapterHeadings("business", "en", null)).toHaveLength(12);
      expect(getExpectedChapterHeadings("technical", "id", null)).toHaveLength(9);
    });

    it("builds numbered chapter headings from custom block IDs", () => {
      const ids = CHAPTER_BLOCKS.slice(0, 15).map((b) => b.id);
      const headings = getExpectedChapterHeadings("business", "en", ids);
      expect(headings).toHaveLength(15);
      expect(headings[0]).toBe(`## 1. ${CHAPTER_BLOCKS[0].titleEn}`);
      expect(headings[14]).toBe(`## 15. ${CHAPTER_BLOCKS[14].titleEn}`);
    });
  });

  describe("countDetectedChapters", () => {
    it("counts H2 chapter headings and ignores H2 comments inside fenced code blocks", () => {
      const md = [
        "## 1. Intro",
        "Some text",
        "```bash",
        "## 99. Not a chapter",
        "echo hi",
        "```",
        "## 2. Scope",
        "~~~python",
        "## 100. Also not a chapter",
        "~~~",
        "### 2.1 Subheading",
        "## 3. Logic",
      ].join("\n");

      const result = countDetectedChapters(md);
      expect(result.count).toBe(3);
      expect(result.maxChapterNumber).toBe(3);
      expect(result.headings).toEqual(["## 1. Intro", "## 2. Scope", "## 3. Logic"]);
    });

    it("handles CRLF line endings cleanly", () => {
      const md = "## 1. One\r\nbody\r\n## 2. Two\r\nbody";
      const result = countDetectedChapters(md);
      expect(result.count).toBe(2);
      expect(result.maxChapterNumber).toBe(2);
    });
  });

  describe("decideContinuation", () => {
    const fifteenHeadings = Array.from({ length: 15 }, (_, i) => `## ${i + 1}. Chapter ${i + 1}`);

    it("never continues when output is empty", () => {
      expect(
        decideContinuation({
          accumulatedText: "   ",
          finishReason: "length",
          expectedHeadings: fifteenHeadings,
        }),
      ).toEqual({ shouldContinue: false });
    });

    it("continues with reason=length when cut off at section 5 of 15", () => {
      const partial = [
        "## 1. Chapter 1\nBody",
        "## 2. Chapter 2\nBody",
        "## 3. Chapter 3\nBody",
        "## 4. Chapter 4\nBody",
        "## 5. Chapter 5\n2. System displays generated thumbnail, 3D mesh preview, and AI-estimated",
      ].join("\n\n");

      const decision = decideContinuation({
        accumulatedText: partial,
        finishReason: "length",
        expectedHeadings: fifteenHeadings,
      });

      expect(decision.shouldContinue).toBe(true);
      if (decision.shouldContinue) {
        expect(decision.reason).toBe("length");
        expect(decision.detectedChapters).toBe(5);
        expect(decision.expectedChapters).toBe(15);
        expect(decision.missingHeadings).toHaveLength(10);
        expect(decision.missingHeadings[0]).toBe("## 6. Chapter 6");
      }
    });

    it("continues with reason=length even if chapter 15 heading exists when cut mid-chapter", () => {
      const cutInLastChapter = fifteenHeadings.map((h) => `${h}\nBody`).join("\n\n");
      const decision = decideContinuation({
        accumulatedText: cutInLastChapter,
        finishReason: "MAX_TOKENS",
        expectedHeadings: fifteenHeadings,
      });

      expect(decision.shouldContinue).toBe(true);
      if (decision.shouldContinue) {
        expect(decision.reason).toBe("length");
        expect(decision.missingHeadings).toEqual([]);
      }
    });

    it("continues with reason=missing_chapters when provider emits stop early", () => {
      const onlyFive = fifteenHeadings.slice(0, 5).map((h) => `${h}\nDone.`).join("\n\n");
      const decision = decideContinuation({
        accumulatedText: onlyFive,
        finishReason: "stop",
        expectedHeadings: fifteenHeadings,
      });

      expect(decision.shouldContinue).toBe(true);
      if (decision.shouldContinue) {
        expect(decision.reason).toBe("missing_chapters");
        expect(decision.missingHeadings[0]).toBe("## 6. Chapter 6");
        expect(decision.missingHeadings).toHaveLength(10);
      }
    });

    it("stops when finish_reason is stop and all expected chapters are present", () => {
      const complete = fifteenHeadings.map((h) => `${h}\nFull content.`).join("\n\n");
      expect(
        decideContinuation({
          accumulatedText: complete,
          finishReason: "stop",
          expectedHeadings: fifteenHeadings,
        }),
      ).toEqual({ shouldContinue: false });
    });

    it("classifies mid-sentence silent stop (Gambar 1) as length instead of skipping to chapter 3", () => {
      const headings13 = Array.from({ length: 13 }, (_, i) => `## ${i + 1}. Bab ${i + 1}`);
      const gambar1 = [
        "## 1. Bab 1\nRingkasan selesai.",
        "## 2. Bab 2\n4. Pencahayaan alami jarang dipertimbangkan di kamar kos.\n5. Negosiasi harga dengan pengrajin terjadi di",
      ].join("\n\n");

      const decision = decideContinuation({
        accumulatedText: gambar1,
        finishReason: "stop",
        expectedHeadings: headings13,
      });

      expect(decision.shouldContinue).toBe(true);
      if (decision.shouldContinue) {
        expect(decision.reason).toBe("length");
        expect(decision.missingHeadings[0]).toBe("## 3. Bab 3");
      }
    });

    it("continues final chapter 13/13 when silently cut mid-table row (Gambar 2)", () => {
      const headings13 = Array.from({ length: 13 }, (_, i) => `## ${i + 1}. Bab ${i + 1}`);
      const first12 = headings13.slice(0, 12).map((h) => `${h}\nSelesai.`).join("\n\n");
      const ch13Cut = [
        "## 13. Bab 13",
        "| PERTANYAAN | DAMPAK | DEADLINE | DECISION MAKER |",
        "|---|---|---|---|",
        "| Lisensi? | Tinggi | 2025-02-14 | Tech Lead |",
        "| Apakah skema monetisasi Pay-per-Generation lewat QRIS memerlukan entitas badan",
      ].join("\n");

      const decision = decideContinuation({
        accumulatedText: `${first12}\n\n${ch13Cut}`,
        finishReason: "stop",
        expectedHeadings: headings13,
      });

      expect(decision.shouldContinue).toBe(true);
      if (decision.shouldContinue) {
        expect(decision.reason).toBe("length");
        expect(decision.detectedChapters).toBe(13);
        expect(decision.expectedChapters).toBe(13);
      }
    });

    it("treats abrupt EOF without [DONE] or finish_reason as length truncation", () => {
      const complete = fifteenHeadings.map((h) => `${h}\nFull content.`).join("\n\n");
      const decision = decideContinuation({
        accumulatedText: complete,
        finishReason: null,
        expectedHeadings: fifteenHeadings,
        sawDone: false,
      });
      expect(decision.shouldContinue).toBe(true);
      if (decision.shouldContinue) {
        expect(decision.reason).toBe("length");
      }
    });
  });

  describe("maxContinuationsFor", () => {
    it("scales retry cap for larger custom PRDs while keeping minimum 5 and ceiling 12", () => {
      expect(maxContinuationsFor(6)).toBe(MAX_CONTINUATIONS);
      expect(maxContinuationsFor(13)).toBe(10);
      expect(maxContinuationsFor(15)).toBe(12);
      expect(maxContinuationsFor(20)).toBe(12);
    });
  });

  describe("prepareAssistantContext", () => {
    it("returns full text when under maxChars", () => {
      const short = "## 1. Intro\nHello world";
      expect(prepareAssistantContext(short, 1000)).toBe(short);
    });

    it("retains heading outline and trailing window when text exceeds maxChars", () => {
      const longBody = "## 1. First\n" + "a".repeat(2000) + "\n## 2. Second\nTAIL_MARKER";
      const result = prepareAssistantContext(longBody, 1200);
      expect(result).toContain("## 1. First");
      expect(result).toContain("## 2. Second");
      expect(result).toContain("TAIL_MARKER");
      expect(result.length).toBeLessThanOrEqual(1250);
    });
  });

  describe("buildContinuationMessages", () => {
    it("constructs 4-turn messages for length truncation with missing chapters", () => {
      const expected = ["## 1. A", "## 2. B", "## 3. C"];
      const msgs = buildContinuationMessages({
        systemPrompt: "SYS",
        userPrompt: "USR",
        accumulatedText: "## 1. A\nCut mid-word",
        decision: {
          shouldContinue: true,
          reason: "length",
          missingHeadings: ["## 2. B", "## 3. C"],
          detectedChapters: 1,
          expectedChapters: 3,
        },
        expectedHeadings: expected,
        language: "en",
      });

      expect(msgs).toHaveLength(4);
      expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
      expect(msgs[2].content).toBe("## 1. A\nCut mid-word");
      expect(msgs[3].content).toContain("Cut mid-word");
      expect(msgs[3].content).toContain("## 2. B");
      expect(msgs[3].content).toContain("## 3. C");
    });

    it("constructs Indonesian missing-chapters continuation prompt verifying active chapter before next heading", () => {
      const expected = ["## 1. A", "## 2. B"];
      const msgs = buildContinuationMessages({
        systemPrompt: "SYS",
        userPrompt: "USR",
        accumulatedText: "## 1. A\nSelesai.",
        decision: {
          shouldContinue: true,
          reason: "missing_chapters",
          missingHeadings: ["## 2. B"],
          detectedChapters: 1,
          expectedChapters: 2,
        },
        expectedHeadings: expected,
        language: "id",
      });

      expect(msgs[3].content).toContain('Periksa dulu "## 1. A"');
      expect(msgs[3].content).toContain('"## 2. B"');
      expect(msgs[3].content).not.toContain("TANPA teks apa pun sebelumnya");
    });
  });

  describe("stripContinuationOverlap", () => {
    it("glues clean mid-sentence continuation without altering text", () => {
      const existing = "2. System displays generated thumbnail, 3D mesh preview, and AI-estimated";
      const next = " dimensions for merchant verification.";
      expect(stripContinuationOverlap(existing, next)).toBe(next);
    });

    it("strips exact echoed suffix phrase at start of continuation", () => {
      const existing = "2. System displays generated thumbnail, 3D mesh preview, and AI-estimated";
      const next = "and AI-estimated dimensions for merchant verification.";
      expect(stripContinuationOverlap(existing, next)).toBe(" dimensions for merchant verification.");
    });

    it("strips echoed trailing line preceded by newline", () => {
      const existing =
        "1. Open screen.\n2. System displays generated thumbnail, 3D mesh preview, and AI-estimated";
      const next =
        "\n2. System displays generated thumbnail, 3D mesh preview, and AI-estimated dimensions.";
      expect(stripContinuationOverlap(existing, next)).toBe(" dimensions.");
    });

    it("strips duplicated partial Markdown table row seamlessly", () => {
      const existing = "| Field | Type | Required? |\n|---|---|---|\n| Length | Number | Yes";
      const next = "| Length | Number | Yes | 5-300 cm |";
      expect(stripContinuationOverlap(existing, next)).toBe(" | 5-300 cm |");
    });

    it("injects blank line before a new H2 heading when previous text lacks trailing newlines", () => {
      expect(stripContinuationOverlap("End of chapter 5.", "## 6. User Stories")).toBe(
        "\n\n## 6. User Stories",
      );
      expect(stripContinuationOverlap("End of chapter 5.\n", "## 6. User Stories")).toBe(
        "\n## 6. User Stories",
      );
      expect(stripContinuationOverlap("End of chapter 5.\n\n", "## 6. User Stories")).toBe(
        "## 6. User Stories",
      );
    });

    it("does not falsely strip short coincidental word prefixes under 6 chars", () => {
      expect(stripContinuationOverlap("Describe the", "thematic layout")).toBe("thematic layout");
    });
  });

  describe("createSeamDeduplicator", () => {
    it("deduplicates echoed text arriving across small streamed token chunks", () => {
      const existing = "2. System displays generated thumbnail, 3D mesh preview, and AI-estimated";
      const dedup = createSeamDeduplicator(existing, 40);
      const chunks = ["and ", "AI-", "estimated", " dimensions ", "for merchant ", "verification and publishing."];
      let out = "";
      for (const c of chunks) {
        out += dedup.feed(c);
      }
      out += dedup.flush();
      expect(out).toBe(" dimensions for merchant verification and publishing.");
    });

    it("flushes short continuation turns smaller than probeChars cleanly", () => {
      const existing = "End of chapter 5.";
      const dedup = createSeamDeduplicator(existing, 200);
      expect(dedup.feed("## 6. ")).toBe("");
      expect(dedup.feed("Summary")).toBe("");
      expect(dedup.flush()).toBe("\n\n## 6. Summary");
      expect(dedup.flush()).toBe("");
    });
  });
});
