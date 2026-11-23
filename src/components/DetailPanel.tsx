import { useEffect, useMemo, type JSX } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, ArrowUpRight, MessageSquarePlus } from "lucide-react";
import type { WbsNode, WbsBulletItem, WbsPriority } from "../utils/wbs";
import { parseBulletTree } from "../utils/wbs";
import type { ThemeMode } from "../utils/theme";
import { POPOVER_FADE, SPRING_SLIDE } from "../utils/motion";
import { useT } from "../hooks/useT";

const REMARK_PLUGINS = [remarkGfm];

const PRIORITY_STYLES: Record<
  WbsPriority,
  { badge: string; dot: string; shortLabel: string }
> = {
  "Must-have": {
    badge:
      "bg-[var(--oa-signal-garnet-tint)] text-[var(--oa-signal-garnet)] border-[var(--oa-signal-garnet)]/35",
    dot: "bg-[var(--oa-signal-garnet)]",
    shortLabel: "MUST",
  },
  "Should-have": {
    badge:
      "bg-[var(--oa-signal-steel-tint)] text-[var(--oa-signal-steel)] border-[var(--oa-signal-steel)]/35",
    dot: "bg-[var(--oa-signal-steel)]",
    shortLabel: "SHOULD",
  },
  "Could-have": {
    badge:
      "bg-[var(--oa-signal-ochre-tint)] text-[var(--oa-signal-ochre)] border-[var(--oa-signal-ochre)]/35",
    dot: "bg-[var(--oa-signal-ochre)]",
    shortLabel: "COULD",
  },
  "Won't-have": {
    badge:
      "bg-[var(--oa-bg-recessed)] text-[var(--oa-text-muted)] border-[var(--oa-border-default)]",
    dot: "bg-[var(--oa-text-muted)]",
    shortLabel: "WONT",
  },
};

/**
 * Map internal tree IDs (e.g. `f-2-2`, `f-2-2-1`, `f-1`) into clean WBS badge
 * codes matching Figma 67:30 (`WBS-2.2`, `WBS-2.2.1`, `M1`, `ROOT`), while
 * preferring explicit feature codes like `FEAT-04` when available.
 */
export function formatWbsDisplayCode(
  node: Pick<WbsNode, "id" | "code" | "type" | "children">,
): string {
  if (node.code && node.code.trim()) return node.code.trim();
  if (node.id === "root" || node.type === "root") return "ROOT";
  const nestedMatch = node.id.match(/^f-(\d+)-(\d+)(?:-(\d+))?$/);
  if (nestedMatch) {
    return nestedMatch[3]
      ? `WBS-${nestedMatch[1]}.${nestedMatch[2]}.${nestedMatch[3]}`
      : `WBS-${nestedMatch[1]}.${nestedMatch[2]}`;
  }
  const subMatch = node.id.match(/^sf-(\d+)-(\d+)$/);
  if (subMatch) {
    return `WBS-${subMatch[1]}.${subMatch[2]}`;
  }
  const topMatch = node.id.match(/^f-(\d+)$/);
  if (topMatch) {
    return node.children.length > 0 ? `M${topMatch[1]}` : `WBS-${topMatch[1]}`;
  }
  return node.id;
}

// ---------------------------------------------------------------------------
// Detail content splitter — tabel / bullet / teks biasa per blok baris.
// - Baris `|...|` (dengan separator GFM) → dibiarkan ke ReactMarkdown → tabel rapi.
// - Baris bullet → parseBulletTree → pohon terstruktur (tidak lagi teks acak).
// - Sisanya → markdown paragraf apa adanya.
// ---------------------------------------------------------------------------

type DetailBlock =
  | { kind: "table" | "text"; md: string }
  | { kind: "bullets"; items: WbsBulletItem[] };

const TABLE_LINE_RE = /^\s*\|/;
const BULLET_LINE_RE = /^\s*[-*•]\s+/;
// GFM membutuhkan baris separator (`|---|`) agar baris pipa jadi tabel.
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*\|(\s*:?-{2,}:?\s*\|)*\s*$/;

// Di-export untuk unit test blok-blok detail.
export function splitDetailBlocks(detail: string): DetailBlock[] {
  if (!detail) return [];
  const blocks: DetailBlock[] = [];
  let buf: string[] = [];
  let kind: "table" | "bullet" | "text" | null = null;
  const flush = () => {
    if (buf.length === 0) return;
    if (kind === "table") {
      // Tanpa separator → bukan tabel di markdown; render sebagai teks biasa.
      if (buf.some((l) => TABLE_SEP_RE.test(l))) blocks.push({ kind: "table", md: buf.join("\n") });
      else blocks.push({ kind: "text", md: buf.join("\n") });
    } else if (kind === "bullet") {
      const items = parseBulletTree(buf.join("\n"));
      if (items.length > 0) blocks.push({ kind: "bullets", items });
      else blocks.push({ kind: "text", md: buf.join("\n") });
    } else {
      blocks.push({ kind: "text", md: buf.join("\n") });
    }
    buf = [];
  };
  for (const line of detail.split("\n")) {
    const t = line.trim();
    const next = !t
      ? null
      : TABLE_LINE_RE.test(t)
        ? "table"
        : BULLET_LINE_RE.test(t)
          ? "bullet"
          : "text";
    if (next !== kind) flush();
    kind = next;
    if (t) buf.push(line);
  }
  flush();
  return blocks;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanSpecificationText(md: string, nodeTitle: string): string {
  let out = md.trim();
  // Remove redundant leading `### FEAT-XX. Title` line when detail came from a FEAT block
  out = out.replace(/^#{1,4}\s+[^\n]+\n*/m, "").trim();
  // Remove redundant `**Node Title**: ` prefix because node.title is already the panel heading
  const titleRe = new RegExp(
    `^(?:\\*\\*)?${escapeRegExp(nodeTitle.trim())}(?:\\*\\*)?\\s*[:：]\\s*`,
    "i",
  );
  out = out.replace(titleRe, "").trim();
  // If the remaining text equals the exact title itself, treat as empty so fallback summary applies
  if (out.toLowerCase() === nodeTitle.trim().toLowerCase()) {
    return "";
  }
  return out;
}

// Nested deliverable list matching Figma 67:30 (Champagne top-level dot, muted nested dot)
function NodeDeliverableList({
  items,
  depth = 0,
}: {
  items: WbsNode[];
  depth?: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-2.5" : "mt-1.5 ml-4 space-y-1.5"}>
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <div className="flex items-start gap-2.5">
            <span
              className={`w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${
                depth === 0
                  ? "bg-[var(--oa-accent-champagne)]"
                  : "bg-[var(--oa-text-muted)]/75"
              }`}
              aria-hidden="true"
            />
            <span
              className={`leading-[1.55] break-words ${
                depth === 0
                  ? "text-[13px] text-[var(--oa-text-primary)]/90"
                  : "text-[12.5px] text-[var(--oa-text-secondary)]"
              }`}
            >
              {item.code && (
                <span className="mr-1.5 text-[10.5px] font-mono text-[var(--oa-text-champagne)]">
                  {item.code}
                </span>
              )}
              {item.title}
            </span>
          </div>
          {item.children.length > 0 && (
            <NodeDeliverableList items={item.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

// Bullet tree fallback when deliverables live in raw markdown detail bullets
function BulletTree({
  items,
  depth = 0,
}: {
  items: WbsBulletItem[];
  depth?: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-2.5" : "mt-1.5 ml-4 space-y-1.5"}>
      {items.map((item, i) => (
        <li key={`${item.title}-${i}`} className="min-w-0">
          <div className="flex items-start gap-2.5">
            <span
              className={`w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${
                depth === 0
                  ? "bg-[var(--oa-accent-champagne)]"
                  : "bg-[var(--oa-text-muted)]/75"
              }`}
              aria-hidden="true"
            />
            <span
              className={`leading-[1.55] break-words ${
                depth === 0
                  ? "text-[13px] text-[var(--oa-text-primary)]/90"
                  : "text-[12.5px] text-[var(--oa-text-secondary)]"
              }`}
            >
              {item.title}
            </span>
          </div>
          {item.children.length > 0 && (
            <BulletTree items={item.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
      {children}
    </a>
  ),
  table: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--oa-border-default)] bg-[var(--oa-bg-recessed)]/75">
      <table className="w-full text-[12px] text-left border-collapse" {...props} />
    </div>
  ),
  thead: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
    <thead
      className="bg-[var(--oa-bg-recessed)] text-[var(--oa-text-muted)] border-b border-[var(--oa-border-default)]"
      {...props}
    />
  ),
  th: ({ node: _n, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
    <th
      className="px-3.5 py-2 font-mono font-medium whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[var(--oa-text-muted)]"
      {...props}
    />
  ),
  tbody: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
    <tbody className="divide-y divide-[var(--oa-border-subtle)]" {...props} />
  ),
  td: ({ node: _n, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
    <td
      className="px-3.5 py-2.5 align-top leading-relaxed text-[var(--oa-text-secondary)] min-w-[96px] text-[12px]"
      {...props}
    />
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="oa-recessed-well p-3 overflow-x-auto rounded-xl text-[12px] font-mono text-[var(--oa-text-primary)]">
      {children}
    </pre>
  ),
};

export interface DetailPanelProps {
  node: WbsNode;
  language: "id" | "en";
  theme?: ThemeMode;
  breadcrumb?: string;
  chapterNumber?: string;
  onClose: () => void;
  onOpenDocument?: () => void;
  onAddNote?: (nodeTitle: string) => void;
}

export function DetailPanel({
  node,
  language,
  theme = "dark",
  breadcrumb,
  chapterNumber,
  onClose,
  onOpenDocument,
  onAddNote,
}: DetailPanelProps): JSX.Element {
  const t = useT(language);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const priorityStyle = node.priority ? PRIORITY_STYLES[node.priority] : undefined;
  const displayCode = useMemo(() => formatWbsDisplayCode(node), [node]);
  const blocks = useMemo(() => splitDetailBlocks(node.detail), [node.detail]);

  const { specTexts, bulletBlocks, tableBlocks } = useMemo(() => {
    const texts: string[] = [];
    const bullets: WbsBulletItem[][] = [];
    const tables: string[] = [];
    for (const block of blocks) {
      if (block.kind === "text") {
        const cleaned = cleanSpecificationText(block.md, node.title);
        if (cleaned) texts.push(cleaned);
      } else if (block.kind === "bullets") {
        bullets.push(block.items);
      } else {
        tables.push(block.md);
      }
    }
    return { specTexts: texts, bulletBlocks: bullets, tableBlocks: tables };
  }, [blocks, node.title]);

  const fallbackSpec =
    specTexts.length === 0
      ? node.children.length > 0
        ? t.wbs.moduleSummary.replace("{count}", String(node.children.length))
        : t.wbs.subfeatureSummary
      : null;

  const openDocLabel = chapterNumber
    ? t.wbs.openChapter.replace("{num}", chapterNumber)
    : t.wbs.openDocument;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={POPOVER_FADE}
        className="fixed inset-0 bg-[var(--oa-scrim)] backdrop-blur-xs z-[60]"
        aria-hidden="true"
        onClick={onClose}
      />

      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={language === "en" ? "Node detail" : "Detail node"}
        initial={{ x: 380 }}
        animate={{ x: 0 }}
        exit={{ x: 380 }}
        transition={SPRING_SLIDE}
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[392px] sm:max-w-[92vw] z-[65] oa-elev-popover border-l border-[var(--oa-border-strong)] flex flex-col"
      >
        {/* Top Meta Header — Figma 67:30: [WBS-X.X] + [● MUST] side-by-side + Close */}
        <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-default)] text-[11px] font-mono font-medium text-[var(--oa-text-primary)] truncate">
              {displayCode}
            </span>
            {priorityStyle && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10.5px] font-mono font-medium tracking-[0.06em] shrink-0 ${priorityStyle.badge}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityStyle.dot}`}
                  aria-hidden="true"
                />
                {priorityStyle.shortLabel}
              </span>
            )}
          </div>

          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label={language === "en" ? "Close detail panel" : "Tutup panel detail"}
            className="p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none cursor-pointer shrink-0"
          >
            <X size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 space-y-6">
          {/* Title & Breadcrumb */}
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--oa-text-primary)] tracking-[-0.015em] leading-snug">
              {node.title}
            </h2>
            {breadcrumb && (
              <p
                className="mt-1 text-[11.5px] font-mono text-[var(--oa-text-muted)] truncate"
                title={breadcrumb}
              >
                {breadcrumb}
              </p>
            )}
          </div>

          {/* Section 1: SPECIFICATION */}
          <section>
            <h3 className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-[var(--oa-text-muted)] mb-2">
              {t.wbs.specification}
            </h3>
            {specTexts.length > 0 ? (
              <div
                className={`prose prose-sm ${theme === "dark" ? "prose-invert" : ""} max-w-none
                  prose-p:text-[13px] prose-p:leading-[1.68] prose-p:text-[var(--oa-text-secondary)] prose-p:my-0 prose-p:mb-2.5 last:prose-p:mb-0
                  prose-strong:text-[var(--oa-text-primary)] prose-strong:font-semibold
                  prose-code:text-[12px] prose-code:font-mono prose-code:text-[var(--oa-text-champagne)]`}
              >
                {specTexts.map((md, idx) => (
                  <ReactMarkdown
                    key={idx}
                    remarkPlugins={REMARK_PLUGINS}
                    components={MARKDOWN_COMPONENTS}
                  >
                    {md}
                  </ReactMarkdown>
                ))}
              </div>
            ) : (
              <p className="text-[13px] leading-[1.68] text-[var(--oa-text-secondary)]">
                {fallbackSpec}
              </p>
            )}
          </section>

          {/* Section 2: DELIVERABLES & SUB-ITEMS */}
          {(node.children.length > 0 || bulletBlocks.length > 0) && (
            <section>
              <h3 className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-[var(--oa-text-muted)] mb-2.5">
                {t.wbs.deliverables}
              </h3>
              {node.children.length > 0 ? (
                <NodeDeliverableList items={node.children} />
              ) : (
                <div className="space-y-3">
                  {bulletBlocks.map((items, idx) => (
                    <BulletTree key={idx} items={items} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Section 3: CRITERIA & SPECS (tables from FEAT-XX / markdown) */}
          {tableBlocks.length > 0 && (
            <section>
              <h3 className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-[var(--oa-text-muted)] mb-2.5">
                {t.wbs.criteria}
              </h3>
              <div className="space-y-3">
                {tableBlocks.map((md, idx) => (
                  <ReactMarkdown
                    key={idx}
                    remarkPlugins={REMARK_PLUGINS}
                    components={MARKDOWN_COMPONENTS}
                  >
                    {md}
                  </ReactMarkdown>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Bottom Footer Actions — Figma 67:30: equal 2-column buttons */}
        {(onOpenDocument || onAddNote) && (
          <div className="shrink-0 px-5 py-3.5 border-t border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)] grid grid-cols-2 gap-2.5">
            {onOpenDocument && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDocument();
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--oa-border-default)] bg-[var(--oa-bg-elevated)] hover:border-[var(--oa-border-strong)] text-[12px] font-medium text-[var(--oa-text-primary)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                <span className="truncate">{openDocLabel}</span>
                <ArrowUpRight size={13} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
              </button>
            )}
            {onAddNote && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddNote(node.title);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--oa-border-champagne)] bg-[var(--oa-accent-champagne-tint)] hover:bg-[var(--oa-accent-champagne)]/20 text-[12px] font-medium text-[var(--oa-text-champagne)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                <MessageSquarePlus size={13} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{t.sheet.addNote}</span>
              </button>
            )}
          </div>
        )}
      </motion.aside>
    </>
  );
}
