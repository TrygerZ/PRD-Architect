// Shared structural truncation detector used by both server auto-continue
// and frontend fallback banner so silent upstream cuts are never missed.

export type TrailingTruncationKind =
  | "unclosed_fence"
  | "unclosed_table_row"
  | "empty_heading"
  | "unclosed_inline_syntax"
  | "mid_sentence";

export interface TrailingTruncation {
  kind: TrailingTruncationKind;
}

const DANGLING_END_WORDS = new Set([
  // Indonesian prepositions, conjunctions, auxiliaries, and incomplete clause tails
  "di",
  "ke",
  "dari",
  "yang",
  "dan",
  "atau",
  "dengan",
  "untuk",
  "pada",
  "dalam",
  "sebagai",
  "adalah",
  "akan",
  "dapat",
  "harus",
  "tidak",
  "bukan",
  "karena",
  "jika",
  "bila",
  "agar",
  "oleh",
  "melalui",
  "secara",
  "antara",
  "tanpa",
  "hingga",
  "sampai",
  "serta",
  "tetapi",
  "namun",
  "bahwa",
  "tentang",
  "terhadap",
  "menggunakan",
  "memiliki",
  "memerlukan",
  "menjadi",
  // English articles, prepositions, conjunctions, auxiliaries
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "that",
  "which",
  "who",
  "and",
  "or",
  "but",
  "if",
  "when",
  "while",
  "into",
  "onto",
  "through",
  "during",
  "without",
  "between",
  "under",
  "over",
  "using",
  "including",
  "such",
  "than",
]);

const TERMINAL_END_RE = /[.!?:;)\]}"'`*%]$/;
const DANGLING_PUNCT_RE = /[,(\[{/\\+=\-\u2013\u2014]$/;
const THEMATIC_BREAK_RE = /^(-{3,}|\*{3,}|_{3,}|={3,})$/;
const GFM_SEP_RE = /^\|?[\s:-]+\|[\s:|-]*$/;

function countPipeCells(line: string): number {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!inner) return 0;
  // Split on unescaped pipes
  return inner.split(/(?<!\\)\|/).length;
}

function findTableHeaderColCount(lines: string[], rowIdx: number): number | null {
  let i = rowIdx;
  while (i > 0 && lines[i - 1].trim().startsWith("|")) {
    i--;
  }
  if (i + 1 <= rowIdx && GFM_SEP_RE.test(lines[i + 1].trim()) && lines[i + 1].includes("-")) {
    return countPipeCells(lines[i]);
  }
  return null;
}

function hasUnclosedInlineSyntax(line: string): boolean {
  // Ignore escaped punctuation
  const stripped = line.replace(/\\./g, "");
  // Odd backticks -> unclosed inline code span
  const backticks = (stripped.match(/`/g) ?? []).length;
  if (backticks % 2 !== 0) return true;

  // Remove complete inline code spans before inspecting bold/link markers
  const withoutCode = stripped.replace(/`[^`]*`/g, "");
  const boldMarkers = (withoutCode.match(/\*\*/g) ?? []).length;
  if (boldMarkers % 2 !== 0) return true;

  // Unclosed markdown link `[label](url`
  if (/\[[^\]]*\]\([^)]*$/.test(withoutCode)) return true;

  return false;
}

/**
 * Inspect the trailing structure of a Markdown PRD to detect silent upstream
 * truncation even when the provider omits `finish_reason: "length"`.
 */
export function detectTrailingTruncation(markdown: string): TrailingTruncation | null {
  if (!markdown || !markdown.trim()) return null;

  const lines = markdown.split(/\r?\n/);

  // 1. Check for unclosed fenced code blocks (``` or ~~~)
  let activeFenceChar: "`" | "~" | null = null;
  let activeFenceLen = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const char = marker[0] as "`" | "~";
      if (!activeFenceChar) {
        activeFenceChar = char;
        activeFenceLen = marker.length;
      } else if (char === activeFenceChar && marker.length >= activeFenceLen && trimmed === marker) {
        activeFenceChar = null;
        activeFenceLen = 0;
      }
    }
  }
  if (activeFenceChar) {
    return { kind: "unclosed_fence" };
  }

  // Locate last non-empty line
  let lastIdx = lines.length - 1;
  while (lastIdx >= 0 && !lines[lastIdx].trim()) {
    lastIdx--;
  }
  if (lastIdx < 0) return null;

  const lastLine = lines[lastIdx].trim();

  // 2. Closed code fence or thematic break -> clean boundary
  if (/^(`{3,}|~{3,})$/.test(lastLine)) return null;
  if (THEMATIC_BREAK_RE.test(lastLine.replace(/ /g, ""))) return null;

  // 3. Heading at EOF with no body after it
  if (/^#{1,6}\s+/.test(lastLine)) {
    return { kind: "empty_heading" };
  }

  // 4. Markdown table row checks
  if (lastLine.startsWith("|")) {
    // Missing closing pipe (e.g. truncated mid-cell)
    if (!lastLine.endsWith("|") || lastLine === "|") {
      return { kind: "unclosed_table_row" };
    }
    // Table ended right on its GFM separator row with zero data rows
    if (GFM_SEP_RE.test(lastLine) && lastLine.includes("-")) {
      return { kind: "unclosed_table_row" };
    }
    // Fewer cells than header row (e.g. stopped after column 1 of 4)
    const headerCols = findTableHeaderColCount(lines, lastIdx);
    if (headerCols !== null && headerCols >= 2) {
      const rowCols = countPipeCells(lastLine);
      if (rowCols < headerCols) {
        return { kind: "unclosed_table_row" };
      }
    }
    return null;
  }

  // 5. Unclosed inline markdown markers (bold, inline code, link)
  if (hasUnclosedInlineSyntax(lastLine)) {
    return { kind: "unclosed_inline_syntax" };
  }

  // 6. Mid-sentence checks on prose / list items
  if (TERMINAL_END_RE.test(lastLine)) {
    return null;
  }

  if (DANGLING_PUNCT_RE.test(lastLine)) {
    return { kind: "mid_sentence" };
  }

  // Strip list marker / blockquote prefix for word analysis
  const body = lastLine
    .replace(/^(?:[-*+]|\d+\.)\s+/, "")
    .replace(/^>\s?/, "")
    .trim();
  const words = body.split(/\s+/).filter(Boolean);

  if (words.length >= 4) {
    const lastWord = words[words.length - 1].toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
    if (lastWord && DANGLING_END_WORDS.has(lastWord)) {
      return { kind: "mid_sentence" };
    }
  }

  // Long prose line (>= 90 chars and >= 12 words) with no closing punctuation
  if (body.length >= 90 && words.length >= 12 && !/\d$/.test(body)) {
    return { kind: "mid_sentence" };
  }

  // Sibling consistency: if previous non-empty line is a sibling list item ending with
  // sentence punctuation (., !, ?) and this list item has >= 5 words with none, it was cut.
  const isListItem = /^(?:[-*+]|\d+\.)\s+/.test(lastLine);
  if (isListItem && words.length >= 5 && lastIdx > 0) {
    let prevIdx = lastIdx - 1;
    while (prevIdx >= 0 && !lines[prevIdx].trim()) prevIdx--;
    if (prevIdx >= 0) {
      const prevLine = lines[prevIdx].trim();
      const prevIsListItem = /^(?:[-*+]|\d+\.)\s+/.test(prevLine);
      if (prevIsListItem && /[.!?]$/.test(prevLine) && !/\d$/.test(body)) {
        return { kind: "mid_sentence" };
      }
    }
  }

  return null;
}
