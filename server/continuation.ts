import { getChapterBlock } from "../shared/chapterBlocks";
import type { PRDMode, TruncationReason } from "../shared/types";

export const MAX_CONTINUATIONS = 5;
export const SEAM_PROBE_CHARS = 300;
export const MAX_ASSISTANT_CONTEXT_CHARS = 60_000;
export const MAX_EXISTING_CONTENT_CHARS = 400_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface UpstreamSSEPayload {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string | null;
  }>;
}

export interface DetectedChapters {
  count: number;
  maxChapterNumber: number;
  headings: string[];
}

export type ContinuationDecision =
  | { shouldContinue: false }
  | {
      shouldContinue: true;
      reason: TruncationReason;
      missingHeadings: string[];
      detectedChapters: number;
      expectedChapters: number;
    };

const STANDARD_HEADINGS: Record<PRDMode, { en: string[]; id: string[] }> = {
  simple: {
    en: [
      "## 1. Problem Statement & Value Proposition",
      "## 2. Feature Scope & MVP Definition",
      "## 3. Out of Scope Rules & Boundaries",
      "## 4. User Stories & Core Workflows",
      "## 5. Feature Specification & Logic",
      "## 6. Open Questions, Success Metrics & Timeline",
    ],
    id: [
      "## 1. Problem Statement & Value Proposition (Pernyataan Masalah & Proposisi Nilai)",
      "## 2. Feature Scope & MVP Definition (Cakupan Fitur & Definisi MVP)",
      "## 3. Out of Scope Rules & Boundaries (Aturan Lingkup & Batasan)",
      "## 4. User Stories & Core Workflows (Cerita Pengguna & Alur Kerja Inti)",
      "## 5. Feature Specification & Logic (Spesifikasi Fitur & Logika)",
      "## 6. Open Questions, Success Metrics & Timeline (Pertanyaan Terbuka, Metrik & Linimasa)",
    ],
  },
  business: {
    en: [
      "## 1. Executive Summary & Value Proposition",
      "## 2. Problem Definition & Market Analysis (TAM/SAM/SOM, Competitors)",
      "## 3. Solution Overview & Scope (MoSCoW)",
      "## 4. User Stories & Acceptance Criteria",
      "## 5. UX Design, User Journey & Wireframe Flow",
      "## 6. High-Level Technical Architecture",
      "## 7. Non-Functional Requirements",
      "## 8. Success Metrics, Business KPIs (MRR, Churn)",
      "## 9. Go-to-Market (GTM) Strategy & Monetization",
      "## 10. Risk Register & Mitigation",
      "## 11. Project Timeline & 12-Week Roadmap",
      "## 12. Regulatory & Compliance",
    ],
    id: [
      "## 1. Executive Summary & Value Proposition (Ringkasan Eksekutif & Proposisi Nilai)",
      "## 2. Problem Definition & Market Analysis (TAM/SAM/SOM, Kompetitor)",
      "## 3. Solution Overview & Scope (MoSCoW)",
      "## 4. User Stories & Acceptance Criteria",
      "## 5. UX Design, User Journey & Wireframe Flow (Desain UX & Alur)",
      "## 6. High-Level Technical Architecture (Arsitektur Teknis Level Atas)",
      "## 7. Non-Functional Requirements (Kebutuhan Non-Fungsional)",
      "## 8. Success Metrics, Business KPIs (Metrik Keberhasilan & KPI Bisnis)",
      "## 9. Go-to-Market (GTM) Strategy & Monetization (Strategi GTM & Monetisasi)",
      "## 10. Risk Register & Mitigation (Daftar Risiko & Mitigasi)",
      "## 11. Project Timeline & 12-Week Roadmap (Linimasa Proyek & Peta Jalan 12 Minggu)",
      "## 12. Regulatory & Compliance (Kepatuhan & Regulasi)",
    ],
  },
  technical: {
    en: [
      "## 1. Project Technical Overview & Core Objective",
      "## 2. Feature Scope & MVP Definition (Strict MoSCoW)",
      "## 3. Data Models & Database Schema",
      "## 4. API Contracts & Interfaces",
      "## 5. Frontend Component Architecture & State Management",
      "## 6. Edge Case & Integration Testing Criteria",
      "## 7. Security, Auth & Non-Functional Requirements",
      "## 8. Error Handling, Fallbacks & Retry Strategies",
      "## 9. AI Agent Implementation Guidelines",
    ],
    id: [
      "## 1. Project Technical Overview & Core Objective (Ringkasan Teknis & Obyektif Inti)",
      "## 2. Feature Scope & MVP Definition (Cakupan Fitur & Definisi MVP - Strict MoSCoW)",
      "## 3. Data Models & Database Schema (Model Data & Skema Database)",
      "## 4. API Contracts & Interfaces (Kontrak API & Antarmuka)",
      "## 5. Frontend Component Architecture & State Management (Arsitektur Komponen & Manajemen State)",
      "## 6. Edge Case & Integration Testing Criteria (Kriteria Pengujian Edge Case)",
      "## 7. Security, Auth & Non-Functional Requirements (Keamanan, Auth & Kebutuhan Non-Fungsional)",
      "## 8. Error Handling, Fallbacks & Retry Strategies (Penanganan Error & Strategi Retry)",
      "## 9. AI Agent Implementation Guidelines (Instruksi Khusus untuk AI Coder)",
    ],
  },
};

const LENGTH_FINISH_REASONS = new Set(["length", "max_tokens", "max_output_tokens"]);

export function extractFinishReason(data: UpstreamSSEPayload): string | null {
  const openAiReason = data.choices?.[0]?.finish_reason;
  if (typeof openAiReason === "string" && openAiReason.trim() !== "") {
    return openAiReason.trim();
  }
  const geminiReason = data.candidates?.[0]?.finishReason;
  if (typeof geminiReason === "string" && geminiReason.trim() !== "") {
    return geminiReason.trim();
  }
  return null;
}

export function isLengthTruncated(finishReason: string | null): boolean {
  if (!finishReason) return false;
  return LENGTH_FINISH_REASONS.has(finishReason.trim().toLowerCase());
}

export function getExpectedChapterHeadings(
  prdMode: PRDMode,
  language: "en" | "id",
  customIds: string[] | null,
): string[] {
  if (customIds && customIds.length > 0) {
    return customIds.map((id, idx) => {
      const block = getChapterBlock(id);
      const title = block ? (language === "en" ? block.titleEn : block.titleId) : id;
      return `## ${idx + 1}. ${title}`;
    });
  }
  const modeMap = STANDARD_HEADINGS[prdMode] ?? STANDARD_HEADINGS.business;
  return modeMap[language] ?? modeMap.en;
}

/**
 * Count level-2 Markdown headings (`## ...`) outside fenced code blocks.
 * Ignoring fenced blocks prevents shell/python comments like `## step` from
 * inflating the chapter count.
 */
export function countDetectedChapters(markdown: string): DetectedChapters {
  if (!markdown) {
    return { count: 0, maxChapterNumber: 0, headings: [] };
  }
  const lines = markdown.split(/\r?\n/);
  let activeFenceChar: "`" | "~" | null = null;
  let activeFenceLen = 0;
  const headings: string[] = [];
  let maxChapterNumber = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const char = marker[0] as "`" | "~";
      if (!activeFenceChar) {
        activeFenceChar = char;
        activeFenceLen = marker.length;
        continue;
      }
      if (char === activeFenceChar && marker.length >= activeFenceLen && trimmed === marker) {
        activeFenceChar = null;
        activeFenceLen = 0;
        continue;
      }
    }
    if (activeFenceChar) continue;

    const h2Match = line.match(/^##\s+(.*)$/);
    if (!h2Match) continue;
    const headingText = h2Match[1].trim();
    if (!headingText) continue;
    headings.push(`## ${headingText}`);
    const numMatch = headingText.match(/^(\d+)\./);
    if (numMatch) {
      const num = Number.parseInt(numMatch[1], 10);
      if (Number.isFinite(num) && num > maxChapterNumber) {
        maxChapterNumber = num;
      }
    }
  }

  return {
    count: headings.length,
    maxChapterNumber,
    headings,
  };
}

export function decideContinuation(params: {
  accumulatedText: string;
  finishReason: string | null;
  expectedHeadings: string[];
}): ContinuationDecision {
  const { accumulatedText, finishReason, expectedHeadings } = params;
  if (!accumulatedText.trim()) {
    return { shouldContinue: false };
  }

  const detected = countDetectedChapters(accumulatedText);
  const expectedCount = expectedHeadings.length;
  const highestSeen = Math.max(detected.count, detected.maxChapterNumber);
  const missingHeadings =
    expectedCount > 0 && highestSeen < expectedCount
      ? expectedHeadings.slice(highestSeen)
      : [];

  if (isLengthTruncated(finishReason)) {
    return {
      shouldContinue: true,
      reason: "length",
      missingHeadings,
      detectedChapters: detected.count,
      expectedChapters: expectedCount,
    };
  }

  if (expectedCount > 0 && detected.count < expectedCount && detected.maxChapterNumber < expectedCount) {
    return {
      shouldContinue: true,
      reason: "missing_chapters",
      missingHeadings,
      detectedChapters: detected.count,
      expectedChapters: expectedCount,
    };
  }

  return { shouldContinue: false };
}

/**
 * Keep the full generated PRD as assistant context when it fits inside the cap.
 * When extremely long, retain a compact list of already-generated headings plus
 * the trailing window so both structure and exact cut-off context stay intact.
 */
export function prepareAssistantContext(
  accumulatedText: string,
  maxChars: number = MAX_ASSISTANT_CONTEXT_CHARS,
): string {
  if (accumulatedText.length <= maxChars) {
    return accumulatedText;
  }
  const detected = countDetectedChapters(accumulatedText);
  const outlineHeader =
    detected.headings.length > 0
      ? `[Earlier chapters already generated:\n${detected.headings.join("\n")}\n...earlier body omitted for length...]\n\n`
      : "[Earlier content omitted for length...]\n\n";
  const tailBudget = Math.max(1000, maxChars - outlineHeader.length);
  return outlineHeader + accumulatedText.slice(-tailBudget);
}

export function buildContinuationMessages(params: {
  systemPrompt: string;
  userPrompt: string;
  accumulatedText: string;
  decision: Extract<ContinuationDecision, { shouldContinue: true }>;
  expectedHeadings: string[];
  language: "en" | "id";
}): ChatMessage[] {
  const { systemPrompt, userPrompt, accumulatedText, decision, expectedHeadings, language } = params;
  const assistantContext = prepareAssistantContext(accumulatedText);
  const isEn = language === "en";
  const lastHeading = expectedHeadings[expectedHeadings.length - 1] ?? "";
  const missingList = decision.missingHeadings.join("\n");

  let continuePrompt: string;
  if (decision.reason === "length") {
    const tailSnippet = accumulatedText.slice(-140).replace(/\r?\n/g, "\\n");
    if (isEn) {
      continuePrompt = [
        "Your previous response was cut off mid-output due to token limits.",
        `It ended right after: "${tailSnippet}"`,
        "CRITICAL CONTINUATION RULES:",
        "1. Continue IMMEDIATELY from the exact next character where your previous output stopped.",
        "2. Do NOT repeat any words, sentences, headings, or table rows from before the cut-off.",
        "3. Do NOT write greetings, apologies, or meta-commentary.",
        "4. Preserve the exact Markdown structure, open tables/lists, and numbering seamlessly.",
        missingList
          ? `5. After finishing the interrupted chapter, generate ALL remaining chapters verbatim in order:\n${missingList}`
          : lastHeading
            ? `5. Finish the interrupted chapter completely through ${lastHeading}.`
            : "5. Finish the remaining content completely.",
      ].join("\n");
    } else {
      continuePrompt = [
        "Respons Anda sebelumnya terpotong di tengah jalan karena batas token.",
        `Teks terakhir berhenti tepat setelah: "${tailSnippet}"`,
        "ATURAN LANJUTAN KRITIS:",
        "1. Lanjutkan SEGERA tepat dari karakter berikutnya setelah titik terpotong.",
        "2. JANGAN mengulang kata, kalimat, heading, atau baris tabel yang sudah ditulis sebelumnya.",
        "3. JANGAN menulis basa-basi, permintaan maaf, atau penjelasan tambahan.",
        "4. Pertahankan struktur Markdown, tabel/daftar yang sedang terbuka, dan penomoran secara mulus.",
        missingList
          ? `5. Setelah menuntaskan bab yang terpotong, hasilkan SEMUA bab tersisa secara berurutan dengan heading persis:\n${missingList}`
          : lastHeading
            ? `5. Tuntaskan bab yang terpotong secara lengkap sampai akhir ${lastHeading}.`
            : "5. Tuntaskan sisa dokumen secara lengkap.",
      ].join("\n");
    }
  } else {
    const firstMissing = decision.missingHeadings[0] ?? lastHeading;
    if (isEn) {
      continuePrompt = [
        `You stopped early after ${decision.detectedChapters} of ${decision.expectedChapters} required chapters.`,
        "CRITICAL CONTINUATION RULES:",
        `1. Start IMMEDIATELY with "${firstMissing}" and NOTHING ELSE before it.`,
        "2. Do NOT repeat any earlier chapters already generated.",
        "3. Do NOT write introductions, apologies, or meta-commentary.",
        `4. Generate ALL remaining chapters completely in exact order:\n${missingList}`,
      ].join("\n");
    } else {
      continuePrompt = [
        `Anda berhenti terlalu awal setelah ${decision.detectedChapters} dari ${decision.expectedChapters} bab yang diwajibkan.`,
        "ATURAN LANJUTAN KRITIS:",
        `1. Mulai SEGERA dengan "${firstMissing}" dan TANPA teks apa pun sebelumnya.`,
        "2. JANGAN mengulang bab-bab sebelumnya yang sudah dihasilkan.",
        "3. JANGAN menulis pembukaan, permintaan maaf, atau penjelasan tambahan.",
        `4. Hasilkan SEMUA bab tersisa secara lengkap dalam urutan persis:\n${missingList}`,
      ].join("\n");
    }
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
    { role: "assistant", content: assistantContext },
    { role: "user", content: continuePrompt },
  ];
}

const MIN_SUFFIX_OVERLAP = 6;
const MIN_LINE_OVERLAP = 4;
const MAX_OVERLAP_WINDOW = 600;

/**
 * Remove echoed suffix/prefix overlap when stitching a continuation response
 * onto previously emitted Markdown, and ensure a clean blank line if the
 * continuation begins with a new `## ` chapter heading.
 */
export function stripContinuationOverlap(existingText: string, continuationText: string): string {
  if (!continuationText) return "";
  if (!existingText) return continuationText;

  const tail = existingText.slice(-MAX_OVERLAP_WINDOW);
  let cleaned = continuationText;

  // Case 1: Exact suffix of existingText repeated at start of continuationText.
  const maxDirectLen = Math.min(tail.length, cleaned.length);
  let matchedDirect = 0;
  for (let len = maxDirectLen; len >= MIN_SUFFIX_OVERLAP; len--) {
    if (tail.endsWith(cleaned.slice(0, len))) {
      matchedDirect = len;
      break;
    }
  }

  if (matchedDirect > 0) {
    cleaned = cleaned.slice(matchedDirect);
  } else {
    // Case 2: Model emitted leading newline(s) then re-emitted the trailing line.
    const leadingNewlineMatch = cleaned.match(/^(\r?\n)+/);
    if (leadingNewlineMatch) {
      const afterNewlines = cleaned.slice(leadingNewlineMatch[0].length);
      const lastNewlineIdx = tail.lastIndexOf("\n");
      const lastLine = (lastNewlineIdx === -1 ? tail : tail.slice(lastNewlineIdx + 1)).replace(/\r$/, "");
      if (lastLine.length >= MIN_LINE_OVERLAP && afterNewlines.startsWith(lastLine)) {
        cleaned = afterNewlines.slice(lastLine.length);
      } else {
        const maxAfterLen = Math.min(tail.length, afterNewlines.length);
        for (let len = maxAfterLen; len >= MIN_SUFFIX_OVERLAP; len--) {
          if (tail.endsWith(afterNewlines.slice(0, len))) {
            cleaned = afterNewlines.slice(len);
            break;
          }
        }
      }
    }
  }

  if (!cleaned) return "";

  // Ensure a new level-2 chapter heading always starts on its own paragraph so
  // frontend `getSections()` (`^##\s+`) never merges it into the previous chapter.
  if (/^##\s+/.test(cleaned)) {
    if (!existingText.endsWith("\n")) {
      return "\n\n" + cleaned;
    }
    if (!existingText.endsWith("\n\n")) {
      return "\n" + cleaned;
    }
  }

  return cleaned;
}

export interface SeamDeduplicator {
  feed: (chunk: string) => string;
  flush: () => string;
}

/**
 * Stateful streaming wrapper around `stripContinuationOverlap`.
 * Buffers up to `probeChars` at the start of a continuation turn so token-sized
 * chunks (e.g. 2-6 chars each) are deduplicated accurately before emitting.
 */
export function createSeamDeduplicator(
  existingText: string,
  probeChars: number = SEAM_PROBE_CHARS,
): SeamDeduplicator {
  let resolved = false;
  let buffer = "";

  return {
    feed(chunk: string): string {
      if (!chunk) return "";
      if (resolved) return chunk;
      buffer += chunk;
      if (buffer.length < probeChars) return "";
      const cleaned = stripContinuationOverlap(existingText, buffer);
      resolved = true;
      buffer = "";
      return cleaned;
    },
    flush(): string {
      if (resolved || !buffer) return "";
      const cleaned = stripContinuationOverlap(existingText, buffer);
      resolved = true;
      buffer = "";
      return cleaned;
    },
  };
}
