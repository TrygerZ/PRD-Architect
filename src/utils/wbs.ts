// WBS parser: extract features + sub-features from generated markdown PRDs.
// Tolerant to LLM output variation (id/en, business/technical/simple). NEVER throws.
//
// Extraction priority (heuristik):
//   1. MoSCoW table  (Ch3 business / Ch2 simple / Ch2 technical)
//   2. Simple mode Ch5: `### FEAT-XX` spec blocks
//   3. Fallback: any `### ` heading + bullets underneath

import type { PRDMode } from "../types";
import type { WbsNode, WbsNodeType, WbsPriority, WbsTree } from "../types";
import { getSections } from "./sections";
import type { Section } from "./sections";

// Re-exported so consumers can `import type { WbsNode } from "../utils/wbs"`.
export type { WbsNode, WbsPriority, WbsTree } from "../types";

const DETAIL_LIMIT = 2000;
const CONTEXT_LINES = 3;

const FEAT_RE = /FEAT[-_\s]?\d+/i;
const BULLET_RE = /^\s*[-*]\s+\*\*([^*]+?)\*\*\s*[:：]?\s*(.*)$/;

// Ch5 spec sub-sections (Tujuan, Input Fields, Flow, ...) are spec, NOT sub-features.
const SPEC_WORDS = new Set([
  "tujuan", "objektif", "deskripsi", "kondisi", "tampil", "input", "fields",
  "flow", "alur", "logika", "bisnis", "error", "states", "loading", "integrasi",
  "goal", "acceptance", "criteria",
]);

const PRIORITY_SYNONYMS: Record<string, WbsPriority> = {
  "must-have": "Must-have", "must have": "Must-have", "must": "Must-have",
  "harus": "Must-have", "wajib": "Must-have",
  "should-have": "Should-have", "should have": "Should-have", "should": "Should-have",
  "sebaiknya": "Should-have",
  "could-have": "Could-have", "could have": "Could-have", "could": "Could-have",
  "mungkin": "Could-have",
  "won't-have": "Won't-have", "won't have": "Won't-have",
  "won’t-have": "Won't-have", "won’t have": "Won't-have",
  "wont-have": "Won't-have", "wont have": "Won't-have",
  "tidak": "Won't-have", "tidak akan": "Won't-have",
};

interface ParsedFeature {
  title: string;
  detail: string;
  priority?: WbsPriority;
  code?: string;
  children: ParsedFeature[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPriority(raw: string | undefined): WbsPriority | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase().replace(/\s*\(.*\)\s*$/, "");
  return PRIORITY_SYNONYMS[key];
}

function detectMode(content: string): PRDMode {
  const count = (content.match(/^##\s/gm) ?? []).length;
  if (count === 6) return "simple";
  if (count === 9) return "technical";
  if (count === 12) return "business";
  const lower = content.toLowerCase();
  if (lower.includes("strict moscow")) return "technical";
  if (lower.includes("moscow")) return "business";
  return "business";
}

function findChapter(sections: Section[], re: RegExp): Section | undefined {
  return sections.find((s) => re.test(s.heading));
}

function cellsOf(line: string): string[] {
  const parts = line.split("|");
  if (parts.length > 0 && parts[0].trim() === "") parts.shift();
  if (parts.length > 0 && parts[parts.length - 1].trim() === "") parts.pop();
  return parts.map((p) => p.trim());
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function isFeatureColumn(cell: string): boolean {
  return /feature|fitur/i.test(cell) && !/priority|prioritas/i.test(cell);
}

// Tables that are NOT feature lists (Non-Goals, User Stories, Assumptions, ...).
const NON_FEATURE_RE = /non-goals|out of scope|di luar lingkup|user stor|assumptions|asumsi/i;

function isNonFeatureCell(cell: string): boolean {
  return NON_FEATURE_RE.test(cell);
}

interface TableBlock {
  rows: string[];
  /** Last non-empty line directly above the block — candidate category label (W1). */
  label?: string;
}

function tableBlocks(content: string): TableBlock[] {
  const blocks: TableBlock[] = [];
  let current: string[] = [];
  let label: string | undefined;
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t.startsWith("|")) {
      current.push(line);
    } else {
      if (current.length > 0) {
        blocks.push({ rows: current, label });
        current = [];
      }
      // baris non-kosong mengganti label; baris kosong mempertahankannya
      if (t) label = t;
    }
  }
  if (current.length > 0) blocks.push({ rows: current, label });
  return blocks;
}

// Category label on the line above a table block: `**Must-have**`, `### Must-have`,
// `Must-have:`, `### **Must-have**`. Single-cell `| Must-have |` rows are handled
// inside the block by the non-columnar branch.
function priorityFromLabelLine(line: string | undefined): WbsPriority | undefined {
  if (!line) return undefined;
  const core = line
    .trim()
    .replace(/^(\*{1,3}\s*)?(#{1,3}\s+)?/, "")
    .replace(/\s*:?\s*$/, "")
    .replace(/^\*+|\*+$/g, "")
    .trim();
  return toPriority(core);
}

function buildDetail(lines: string[], rowIndex: number): string {
  const from = Math.max(0, rowIndex - CONTEXT_LINES);
  const to = Math.min(lines.length, rowIndex + 1 + CONTEXT_LINES);
  return lines.slice(from, to).join("\n").slice(0, DETAIL_LIMIT);
}

// ---------------------------------------------------------------------------
// Strategy 0: hierarchical "Feature Breakdown (WBS)" section — nested bullets
// ---------------------------------------------------------------------------

const BREAKDOWN_HEADING_RE = /feature breakdown|work breakdown|wbs|pohon fitur|rincian fitur|struktur fitur/i;
const BREAKDOWN_BULLET_RE = /^\s*([-*•])\s+(.*)$/;
const BREAKDOWN_STRONG_RE = /^\*\*([^*]+?)\*\*\s*[:：—-]?\s*(.*)$/;

interface Bullet {
  depth: number;
  title: string;
  raw: string;
}

// Lowercase, hapus non-alphanumeric, collapse — fuzzy title match untuk merge MoSCoW.
function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function breakdownBullets(block: string[]): Bullet[] {
  const out: Bullet[] = [];
  for (const line of block) {
    const m = line.match(BREAKDOWN_BULLET_RE);
    if (!m) continue; // abaikan baris non-bullet di dalam blok
    const indent = line.length - line.trimStart().length;
    const rest = m[2].trim();
    // Bold label jadi title (kunci merge), sisa teks dibuang; tanpa bold → seluruh teks.
    const bm = rest.match(BREAKDOWN_STRONG_RE);
    const title = bm ? bm[1].trim().replace(/[:：]\s*$/, "") : rest.replace(/\*\*/g, "").trim();
    if (!title) continue;
    out.push({ depth: Math.round(indent / 2), title, raw: line.trim() });
  }
  if (out.length === 0) return out;
  const min = Math.min(...out.map((b) => b.depth));
  for (const b of out) b.depth -= min;
  return out;
}

function buildBreakdownTree(bullets: Bullet[]): ParsedFeature[] {
  const roots: ParsedFeature[] = [];
  const stack: { depth: number; node: ParsedFeature }[] = [];
  for (const b of bullets) {
    const node: ParsedFeature = { title: b.title, detail: b.raw, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].depth >= b.depth) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ depth: b.depth, node });
  }
  return roots;
}

// detail per node = gabungan raw baris-baris bullet di subtree-nya (snippet, cap DETAIL_LIMIT)
function fillSubtreeDetails(nodes: ParsedFeature[]): void {
  for (const n of nodes) {
    fillSubtreeDetails(n.children);
    n.detail = [n.detail, ...n.children.map((c) => c.detail)].join("\n").slice(0, DETAIL_LIMIT);
  }
}

function parseBreakdown(content: string): ParsedFeature[] | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const hm = lines[i].match(/^(#{1,4})\s+(.*)$/);
    if (!hm || !BREAKDOWN_HEADING_RE.test(hm[2])) continue;
    const level = hm[1].length;
    const block: string[] = [];
    i++;
    for (; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+/);
      if (m && m[1].length <= level) break;
      block.push(lines[i]);
    }
    const roots = buildBreakdownTree(breakdownBullets(block));
    if (roots.length === 0) return null;
    fillSubtreeDetails(roots);
    return roots;
  }
  return null;
}

const PRIORITY_RANK: Record<WbsPriority, number> = {
  "Must-have": 0,
  "Should-have": 1,
  "Could-have": 2,
  "Won't-have": 3,
};

function bestChildPriority(nodes: ParsedFeature[]): WbsPriority | undefined {
  let best: WbsPriority | undefined;
  for (const n of nodes) {
    if (!n.priority) continue;
    if (!best || PRIORITY_RANK[n.priority] < PRIORITY_RANK[best]) best = n.priority;
  }
  return best;
}

// Salin priority + code + detail MoSCoW ke fitur breakdown Level-2 via normalized title.
function mergeMoscow(breakdown: ParsedFeature[], moscow: ParsedFeature[]): void {
  if (moscow.length === 0) return;
  const byTitle = new Map<string, ParsedFeature>();
  for (const m of moscow) {
    const k = normalizeTitle(m.title);
    if (k && !byTitle.has(k)) byTitle.set(k, m);
  }
  // Level-1 = module hanya jika minimal satu punya children; kalau tidak, L1 = features.
  const moduleStyle = breakdown.some((r) => r.children.length > 0);
  const targets = moduleStyle ? breakdown.flatMap((r) => r.children) : breakdown;
  for (const t of targets) {
    const m = byTitle.get(normalizeTitle(t.title));
    if (!m) continue;
    if (m.priority) t.priority = m.priority;
    if (m.code) t.code = m.code;
    if (m.detail) t.detail = m.detail; // detail MoSCoW menang
  }
  if (moduleStyle) {
    for (const r of breakdown) {
      const p = bestChildPriority(r.children);
      if (p) r.priority = p;
    }
  }
}

function breakdownNode(f: ParsedFeature, id: string, type: WbsNodeType): WbsNode {
  return {
    id,
    type,
    title: f.title,
    detail: f.detail,
    priority: f.priority,
    code: f.code,
    children: f.children.map((c, j) => breakdownNode(c, `${id}-${j + 1}`, "subfeature")),
  };
}

// ---------------------------------------------------------------------------
// Strategy 1: MoSCoW table
// ---------------------------------------------------------------------------

function parseMoscowTable(block: TableBlock): ParsedFeature[] {
  const rows = block.rows.map(cellsOf);
  const headerIdx = rows.findIndex((r) => !isSeparator(r));
  if (headerIdx < 0) return [];

  const header = rows[headerIdx];
  // W3: Non-Goals / Out of Scope / User Stories / Assumptions tables are NOT features.
  if (header.some(isNonFeatureCell)) return [];

  const featCol = header.findIndex(isFeatureColumn);
  const prioCol = header.findIndex((c) => /priority|prioritas/i.test(c));
  const colBased = featCol >= 0;
  const labelPriority = priorityFromLabelLine(block.label);

  const out: ParsedFeature[] = [];
  let currentCategory: WbsPriority | undefined;

  rows.forEach((cells, i) => {
    if (colBased && i <= headerIdx) return; // skip header row for col-based tables
    if (isSeparator(cells)) return;
    const nonEmpty = cells.filter(Boolean);

    if (colBased) {
      const title = nonEmpty[featCol];
      if (!title) return;
      // W1: kolom priority menang; jika tidak ada, pakai label kategori di atas blok.
      const priority = toPriority(nonEmpty[prioCol]) ?? labelPriority;
      out.push({ title, detail: buildDetail(block.rows, i), priority, children: [] });
      return;
    }

    // Non-columnar: category labels + items below them
    if (nonEmpty.length === 1) {
      const cell = nonEmpty[0];
      if (isNonFeatureCell(cell)) return;
      const p = toPriority(cell);
      if (p) {
        currentCategory = p; // category header row, e.g. `| Must-have |`
      } else if (currentCategory) {
        // bare item under a category — tanpa kategori, blok single-col ditolak (W3)
        out.push({ title: cell, detail: buildDetail(block.rows, i), priority: currentCategory, children: [] });
      }
      return;
    }

    // `| Must-have | Feature A |` — priority label as first cell
    const p = toPriority(nonEmpty[0]);
    if (p && nonEmpty.length === 2) {
      out.push({ title: nonEmpty[1], detail: buildDetail(block.rows, i), priority: p, children: [] });
    }
    // Multi-cell rows without a leading priority label (e.g. Non-Goals / User
    // Stories tables) are NOT MoSCoW features — skip.
  });

  return out;
}

// ---------------------------------------------------------------------------
// Strategy 2: Simple mode Ch5 — `### FEAT-XX` spec blocks
// ---------------------------------------------------------------------------

function featTitle(heading: string): { code: string; title: string } {
  const clean = heading.replace(/^#{1,6}\s*/, "").trim();
  const m = clean.match(/(FEAT[-_\s]?\d+)\s*[-—–:：.]?\s*(.*)/i);
  if (!m) return { code: "", title: clean };
  const code = m[1].toUpperCase();
  const title = m[2].trim();
  return { code, title: title || code };
}

function isSpecLabel(label: string): boolean {
  const words = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => SPEC_WORDS.has(w));
}

function subfeaturesOf(lines: string[]): ParsedFeature[] {
  const subs: ParsedFeature[] = [];
  for (const line of lines) {
    const m = line.match(BULLET_RE);
    if (!m) continue;
    // `**Label:**` renders "Label:" — strip the trailing colon from the title
    const label = m[1].trim().replace(/[:：]\s*$/, "");
    if (isSpecLabel(label)) continue; // Tujuan / Input Fields / Flow ... are spec, not sub-features
    subs.push({ title: label, detail: line.slice(0, DETAIL_LIMIT), children: [] });
  }
  return subs;
}

function extractFeatSpecs(content: string): ParsedFeature[] {
  const blocks: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of content.split("\n")) {
    const m = line.match(/^###\s+(.*)/);
    if (m) {
      if (current) blocks.push(current);
      current = { heading: line, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  return blocks
    .filter((b) => FEAT_RE.test(b.heading))
    .map((b) => {
      const { code, title } = featTitle(b.heading);
      return {
        title,
        code,
        detail: b.lines.join("\n").slice(0, DETAIL_LIMIT),
        children: subfeaturesOf(b.lines),
      };
    });
}

// ---------------------------------------------------------------------------
// Strategy 3: Fallback — any `### ` heading + bullets underneath
// ---------------------------------------------------------------------------

function extractFallback(content: string): ParsedFeature[] {
  const out: ParsedFeature[] = [];
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^###\s+(.+)/);
    if (!m) {
      i++;
      continue;
    }
    const block = [lines[i++]];
    while (i < lines.length && !/^#{1,3}\s/.test(lines[i])) {
      block.push(lines[i++]);
    }
    out.push({
      title: m[1].trim(),
      detail: block.join("\n").slice(0, DETAIL_LIMIT),
      children: subfeaturesOf(block),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function featureNode(n: number, f: ParsedFeature): WbsNode {
  return {
    id: `f-${n}`,
    type: "feature",
    title: f.title,
    detail: f.detail,
    priority: f.priority,
    code: f.code,
    children: f.children.map((c, j) => ({
      id: `sf-${n}-${j + 1}`,
      type: "subfeature",
      title: c.title,
      detail: c.detail,
      priority: c.priority,
      code: c.code,
      children: [],
    })),
  };
}

export function extractWbs(content: string, prdMode?: PRDMode): WbsTree {
  const warnings: string[] = [];
  const tree: WbsTree = {
    root: { id: "root", type: "root", title: "PRD", detail: "", children: [] },
    source: "markdown",
    warnings,
  };

  if (!content || !content.trim()) {
    warnings.push("Empty input: no content to parse");
    return tree;
  }

  const mode = prdMode ?? detectMode(content);
  const sections = getSections(content);

  try {
    let features: ParsedFeature[] = [];

    // Strategy 0: hierarchical "Feature Breakdown (WBS)" section — nested bullets
    const breakdown = parseBreakdown(content);

    // Strategy 1: MoSCoW table — sumber priority/code/detail untuk breakdown,
    // atau fallback fitur flat bila tidak ada breakdown.
    const moscow: ParsedFeature[] = [];
    const moscowChapter = findChapter(sections, /moscow|feature scope/i);
    if (moscowChapter) {
      for (const block of tableBlocks(moscowChapter.content)) {
        moscow.push(...parseMoscowTable(block));
      }
      if (moscow.length === 0) {
        warnings.push(`MoSCoW table not found in "${moscowChapter.heading}", using fallback`);
      }
    } else {
      warnings.push("MoSCoW chapter not found, using fallback");
    }

    if (breakdown) {
      // breakdown menang; MoSCoW hanya memberi priority/code/detail via title-match
      mergeMoscow(breakdown, moscow);
      features = breakdown;
    } else {
      features = moscow;

      // Strategy 2: Simple mode Ch5 FEAT-XX spec blocks
      if (features.length === 0 && mode === "simple") {
        features = extractFeatSpecs(content);
        if (features.length > 0) {
          warnings.push(`No MoSCoW table found; used Ch5 FEAT-XX specs as features`);
        }
      }

      // Strategy 3: generic `### ` headings
      if (features.length === 0) {
        features = extractFallback(content);
        if (features.length === 0) {
          warnings.push("No features found in document");
        }
      }
    }

    tree.root.children = breakdown
      ? breakdown.map((m, i) => breakdownNode(m, `f-${i + 1}`, "feature"))
      : features.map((f, i) => featureNode(i + 1, f));
  } catch (err) {
    warnings.push(`Parser error: ${err instanceof Error ? err.message : String(err)}`);
  }
  return tree;
}

/** DFS pre-order flatten — dipakai canvas untuk render WBS tree. */
export function flattenWbs(node: WbsNode): WbsNode[] {
  const out: WbsNode[] = [node];
  for (const child of node.children) out.push(...flattenWbs(child));
  return out;
}
