// Shared Markdown parsing, inline styling, list nesting, proportional table sizing,
// and rich-text wrapping helpers used by both DOCX and PDF exporters.
import { getSections } from "./sections";
import { normalizeBrTags } from "./format";

export function fenceLang(fenceLine: string): string {
  return (
    fenceLine
      .trim()
      .replace(/^```+/, "")
      .trim()
      .toLowerCase()
      .split(/\s+/)[0] || ""
  );
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function stripHtmlTags(line: string): string {
  return line
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "");
}

export function stripYamlFrontmatter(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  let i = 1;
  while (i < lines.length && lines[i].trim() !== "---") {
    i++;
  }
  return i < lines.length ? i + 1 : 0;
}

export function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1");
}

export interface InlineSeg {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export function parseInline(text: string): InlineSeg[] {
  const segs: InlineSeg[] = [];
  const push = (t: string, s: Partial<InlineSeg> = {}) => {
    if (t) segs.push({ text: t, ...s });
  };
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        push(text.slice(i + 2, end), { bold: true });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        push(text.slice(i + 1, end), { italic: true });
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        push(text.slice(i + 1, end), { code: true });
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "[") {
      const close = text.indexOf("]", i + 1);
      if (close !== -1 && text[close + 1] === "(") {
        const urlEnd = text.indexOf(")", close + 2);
        if (urlEnd !== -1) {
          push(text.slice(i + 1, close));
          i = urlEnd + 1;
          continue;
        }
      }
    }
    let j = i;
    while (j < text.length && text[j] !== "*" && text[j] !== "`" && text[j] !== "[") j++;
    if (j === i) j++;
    push(text.slice(i, j));
    i = j;
  }
  return segs;
}

export interface RunSpec {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export function inlineRunSpecs(text: string, baseBold = false): RunSpec[] {
  return parseInline(normalizeBrTags(text)).map((seg) => ({
    text: seg.text,
    ...(baseBold || seg.bold ? { bold: true } : {}),
    ...(seg.italic ? { italic: true } : {}),
    ...(seg.code ? { code: true } : {}),
  }));
}

export interface ParsedTable {
  header: string[];
  rows: string[][];
}

export function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => normalizeBrTags(c.trim()));
}

export function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(line) && line.includes("-");
}

export function isThematicBreak(line: string): boolean {
  const collapsed = line.trim().replace(/ /g, "");
  return /^(-{3,}|\*{3,}|_{3,}|={3,})$/.test(collapsed);
}

export function isGfmSeparatorRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && /^[\s|:\-]+$/.test(t);
}

export function collectTableBodyRows(
  lines: string[],
  startIdx: number,
): { rows: string[][]; endIdx: number } {
  const rows: string[][] = [];
  let i = startIdx;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t.startsWith("|")) {
      if (isThematicBreak(t) && lines[i + 1]?.trim().startsWith("|")) {
        i++;
        continue;
      }
      break;
    }
    if (isGfmSeparatorRow(t)) {
      i++;
      continue;
    }
    rows.push(parseTableRow(lines[i]));
    i++;
  }
  return { rows, endIdx: i };
}

export function collectWbsBlock(
  lines: string[],
  startIdx: number,
  level: number,
): { endIdx: number; block: string } {
  const block: string[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= level) break;
    block.push(lines[i]);
    i++;
  }
  return { endIdx: i, block: block.join("\n") };
}

export function wbsHeaders(language: "id" | "en"): string[] {
  return language === "en" ? ["Module", "Feature", "Sub-feature"] : ["Modul", "Fitur", "Sub-fitur"];
}

export interface ParsedListItem {
  kind: "bullet" | "ordered";
  level: 0 | 1 | 2;
  marker: string;
  text: string;
}

/**
 * Parse a raw Markdown line into a nested bullet or ordered list item BEFORE
 * `.trim()` strips leading indentation. Every 2 spaces (or 1 tab) increases depth.
 */
export function parseListLine(rawLine: string): ParsedListItem | null {
  const cleanLine = stripHtmlTags(rawLine);
  const indentMatch = cleanLine.match(/^([ \t]*)/);
  const indentStr = indentMatch ? indentMatch[1] : "";
  const indentSpaces = indentStr.replace(/\t/g, "  ").length;
  const level = Math.min(2, Math.floor(indentSpaces / 2)) as 0 | 1 | 2;
  const rest = cleanLine.slice(indentStr.length);

  const bulletMatch = rest.match(/^([-*+])\s+(.*)$/);
  if (bulletMatch) {
    return {
      kind: "bullet",
      level,
      marker: bulletMatch[1],
      text: bulletMatch[2].trim(),
    };
  }

  const orderedMatch = rest.match(/^(\d+\.)\s+(.*)$/);
  if (orderedMatch) {
    return {
      kind: "ordered",
      level,
      marker: orderedMatch[1],
      text: orderedMatch[2].trim(),
    };
  }

  return null;
}

/**
 * Compute proportional column widths (in pt or DXA twips) based on header and
 * 75th-percentile body text length so narrow ID/Status/Date columns stay compact
 * while description columns receive generous horizontal space.
 */
export function computeColumnWeights(
  header: string[],
  rows: string[][],
  totalWidth: number,
  minColWidth: number,
): number[] {
  const colCount = header.length;
  if (colCount <= 0) return [];
  if (colCount === 1) return [totalWidth];

  const effectiveMin = Math.min(minColWidth, Math.floor(totalWidth / colCount));

  const scores = header.map((h, ci) => {
    const headerLen = Math.max(4, stripInline(h).trim().length);
    const bodyLens = rows
      .map((r) => stripInline(r[ci] ?? "").trim().length)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    const p75Len =
      bodyLens.length > 0
        ? bodyLens[Math.min(bodyLens.length - 1, Math.floor(bodyLens.length * 0.75))]
        : headerLen;

    // Damp extreme ratios so a 250-char cell doesn't crush narrow metadata columns
    const representative = Math.max(headerLen, p75Len);
    return Math.pow(Math.min(180, Math.max(6, representative)), 0.72);
  });

  const sumScores = scores.reduce((acc, s) => acc + s, 0) || colCount;
  const rawWidths = scores.map((s) => Math.max(effectiveMin, (s / sumScores) * totalWidth));

  // Normalize back to exact totalWidth while respecting effectiveMin
  const clampedSum = rawWidths.reduce((acc, w) => acc + w, 0);
  if (clampedSum > totalWidth) {
    const excess = clampedSum - totalWidth;
    const shrinkable = rawWidths.map((w) => Math.max(0, w - effectiveMin));
    const shrinkTotal = shrinkable.reduce((acc, s) => acc + s, 0);
    if (shrinkTotal > 0) {
      for (let i = 0; i < colCount; i++) {
        rawWidths[i] -= (shrinkable[i] / shrinkTotal) * excess;
      }
    }
  } else if (clampedSum < totalWidth) {
    const spare = totalWidth - clampedSum;
    for (let i = 0; i < colCount; i++) {
      rawWidths[i] += (scores[i] / sumScores) * spare;
    }
  }

  const rounded = rawWidths.map((w) => Math.floor(w));
  const remainder = Math.round(totalWidth) - rounded.reduce((acc, w) => acc + w, 0);
  if (remainder !== 0) {
    let widestIdx = 0;
    for (let i = 1; i < colCount; i++) {
      if (rounded[i] > rounded[widestIdx]) widestIdx = i;
    }
    rounded[widestIdx] += remainder;
  }

  return rounded;
}

/**
 * Compute clean display size for an exported Mermaid diagram.
 * Scales large diagrams down to fit within maxW x maxH, and caps upscaling
 * (default 1.15x) so compact 3-node diagrams do not stretch into blurry giants.
 */
export function computeMermaidDisplaySize(
  width: number,
  height: number,
  maxW: number,
  maxH: number,
  maxScale = 1.15,
): { width: number; height: number } {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const fitScale = Math.min(maxW / safeW, maxH / safeH, maxScale);
  return {
    width: Math.round(safeW * fitScale),
    height: Math.round(safeH * fitScale),
  };
}

export interface ExportDocMeta {
  title: string;
  subtitle: string;
  eyebrow: string;
  dateLabel: string;
  chapterCount: number;
}

export function buildExportMeta(
  content: string,
  productType: string,
  language: "id" | "en",
  now: Date = new Date(),
): ExportDocMeta {
  const sections = getSections(content);
  const chapterCount = sections.length;
  const cleanType = productType && productType !== "Unknown" ? productType.trim() : "";

  // Check if markdown starts with an explicit H1 title
  const h1Match = content.match(/^#\s+(.+)$/m);
  const rawTitle = h1Match ? stripInline(h1Match[1]).trim() : "";
  const title =
    rawTitle ||
    (cleanType
      ? language === "en"
        ? `${cleanType} - Product Requirements Document`
        : `${cleanType} - Dokumen Spesifikasi Produk (PRD)`
      : language === "en"
        ? "Product Requirements Document"
        : "Dokumen Spesifikasi Produk (PRD)");

  const dateLabel = now.toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const eyebrow =
    language === "en" ? "PRODUCT REQUIREMENTS DOCUMENT" : "DOKUMEN SPESIFIKASI PRODUK (PRD)";

  const parts: string[] = [];
  if (cleanType) parts.push(cleanType);
  if (chapterCount > 0) {
    parts.push(language === "en" ? `${chapterCount} Chapters` : `${chapterCount} Bab`);
  }
  parts.push(dateLabel);

  return {
    title,
    subtitle: parts.join("  |  "),
    eyebrow,
    dateLabel,
    chapterCount,
  };
}

export interface LayoutToken {
  text: string;
  seg: InlineSeg;
  space: boolean;
}

/**
 * Single source of truth for rich-text word wrapping (used by both cell height
 * measurement and drawing). Supports distinct first-line vs continuation-line
 * widths so hanging-indent list items never overflow the right margin.
 */
export function layoutInline(
  segs: InlineSeg[],
  availWidth: number,
  measure: (text: string, seg: InlineSeg) => number,
  breakLongWords = false,
  continuationWidth?: number,
): LayoutToken[][] {
  const tokens: LayoutToken[] = [];
  for (const seg of segs) {
    for (const part of seg.text.split(/(\s+)/)) {
      if (part === "") continue;
      tokens.push({ text: part, seg, space: /^\s+$/.test(part) });
    }
  }

  const lines: LayoutToken[][] = [];
  let line: LayoutToken[] = [];
  let x = 0;
  let hasContent = false;
  const lineLimit = () => (lines.length === 0 ? availWidth : (continuationWidth ?? availWidth));
  const newLine = () => {
    lines.push(line);
    line = [];
    x = 0;
    hasContent = false;
  };

  for (const tok of tokens) {
    const w = measure(tok.text, tok.seg);
    const limit = lineLimit();
    if (tok.space) {
      if (!hasContent) continue;
      if (x + w > limit) newLine();
      else {
        line.push(tok);
        x += w;
      }
      continue;
    }
    if (hasContent && x + w > limit) newLine();
    const curLimit = lineLimit();
    if (breakLongWords && w > curLimit) {
      let chunk = "";
      for (const ch of tok.text) {
        if (chunk !== "" && x + measure(chunk + ch, tok.seg) > lineLimit()) {
          line.push({ text: chunk, seg: tok.seg, space: false });
          newLine();
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk !== "") {
        line.push({ text: chunk, seg: tok.seg, space: false });
        x += measure(chunk, tok.seg);
        hasContent = true;
      }
      continue;
    }
    line.push(tok);
    x += w;
    hasContent = true;
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

export function richCellHeight(nLines: number, fontSize: number, padVertical: number): number {
  return padVertical + nLines * fontSize * 1.4;
}
