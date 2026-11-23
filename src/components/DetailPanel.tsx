import { useEffect, useMemo, type JSX } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Box, FileText, MessageSquarePlus } from "lucide-react";
import type { WbsNode, WbsBulletItem, WbsPriority } from "../utils/wbs";
import { parseBulletTree } from "../utils/wbs";
import type { ThemeMode } from "../utils/theme";
import { POPOVER_FADE, SPRING_SLIDE } from "../utils/motion";
import { useT } from "../hooks/useT";

const PRIORITY_STYLES: Record<WbsPriority, { badge: string; dot: string }> = {
  "Must-have": {
    badge:
      "bg-[var(--oa-signal-garnet-tint)] text-[var(--oa-signal-garnet)] border-[var(--oa-signal-garnet)]/35",
    dot: "bg-[var(--oa-signal-garnet)]",
  },
  "Should-have": {
    badge:
      "bg-[var(--oa-signal-steel-tint)] text-[var(--oa-signal-steel)] border-[var(--oa-signal-steel)]/35",
    dot: "bg-[var(--oa-signal-steel)]",
  },
  "Could-have": {
    badge:
      "bg-[var(--oa-signal-ochre-tint)] text-[var(--oa-signal-ochre)] border-[var(--oa-signal-ochre)]/35",
    dot: "bg-[var(--oa-signal-ochre)]",
  },
  "Won't-have": {
    badge:
      "bg-[var(--oa-bg-recessed)] text-[var(--oa-text-muted)] border-[var(--oa-border-default)]",
    dot: "bg-[var(--oa-text-muted)]",
  },
};

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

// Render pohon bullet sebagai struktur teratur: level 1 = grup tebal + chip
// tipe, level 2+ = baris dot + judul, indent bergeser per level.
function BulletTree({
  items,
  depth = 0,
  nodeType,
}: {
  items: WbsBulletItem[];
  depth?: number;
  nodeType: WbsNode["type"];
}) {
  return (
    <div
      role="list"
      className={depth === 0 ? "space-y-1.5" : "mt-1 space-y-1"}
      style={depth > 0 ? { marginLeft: 16 } : undefined}
    >
      {items.map((item, i) => (
        <div key={i} role="listitem">
          {depth === 0 ? (
            <div className="flex items-center gap-2 py-1.5 border-b border-[var(--oa-border-subtle)]">
              <span className="text-[13px] font-semibold text-[var(--oa-text-primary)] leading-snug">
                {item.title}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] px-1.5 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] shrink-0">
                {nodeType}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border border-[var(--oa-border-subtle)] bg-[var(--oa-bg-recessed)]">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  depth === 1
                    ? "bg-[var(--oa-accent-champagne)]"
                    : "bg-[var(--oa-text-muted)]"
                }`}
                aria-hidden="true"
              />
              <span className="text-[12.5px] text-[var(--oa-text-secondary)] leading-snug">
                {item.title}
              </span>
            </div>
          )}
          {item.children.length > 0 && (
            <BulletTree items={item.children} depth={depth + 1} nodeType={nodeType} />
          )}
        </div>
      ))}
    </div>
  );
}

export interface DetailPanelProps {
  node: WbsNode;
  language: "id" | "en";
  theme?: ThemeMode;
  breadcrumb?: string;
  onClose: () => void;
  onOpenDocument?: () => void;
  onAddNote?: (nodeTitle: string) => void;
}

export function DetailPanel({
  node,
  language,
  theme = "dark",
  breadcrumb,
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
  const blocks = useMemo(() => splitDetailBlocks(node.detail), [node.detail]);

  const markdownComponents = useMemo<Components>(
    () => ({
      a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
          {children}
        </a>
      ),
      table: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
        <div className="w-full overflow-x-auto my-4 rounded-xl border border-[var(--oa-border-default)] bg-[var(--oa-bg-surface)]">
          <table className="w-full text-[12.5px] text-left border-collapse" {...props} />
        </div>
      ),
      thead: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
        <thead
          className="bg-[var(--oa-bg-recessed)] text-[var(--oa-text-primary)] border-b border-[var(--oa-border-default)]"
          {...props}
        />
      ),
      th: ({ node: _n, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
        <th
          className="px-3.5 py-2 font-mono font-semibold whitespace-nowrap text-[10.5px] uppercase tracking-[0.06em] text-[var(--oa-text-muted)]"
          {...props}
        />
      ),
      tbody: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
        <tbody className="divide-y divide-[var(--oa-border-default)]" {...props} />
      ),
      td: ({ node: _n, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
        <td
          className="px-3.5 py-2 align-top leading-relaxed text-[var(--oa-text-secondary)] min-w-[110px] text-[12.5px]"
          {...props}
        />
      ),
      pre: ({ children }: { children?: React.ReactNode }) => (
        <pre className="oa-recessed-well p-3 overflow-x-auto rounded-xl text-[12px] font-mono text-[var(--oa-text-primary)]">
          {children}
        </pre>
      ),
    }),
    [],
  );

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
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[380px] sm:max-w-[90vw] z-[65] oa-elev-popover border-l border-[var(--oa-border-strong)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] flex items-center justify-center text-[var(--oa-text-champagne)] shrink-0">
              <Box size={14} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[11px] font-mono text-[var(--oa-text-champagne)] truncate">
              {node.code || node.id}
            </span>
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
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          <h2 className="text-[17px] font-semibold text-[var(--oa-text-primary)] tracking-tight leading-snug">
            {node.title}
          </h2>

          {breadcrumb && (
            <p
              className="mt-1 text-[11px] font-mono text-[var(--oa-text-muted)] truncate"
              title={breadcrumb}
            >
              {breadcrumb}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 mb-4">
            {node.priority && priorityStyle ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-medium ${priorityStyle.badge}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityStyle.dot}`}
                  aria-hidden="true"
                />
                <span>{node.priority}</span>
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-default)] text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
                {node.type}
              </span>
            )}
            {node.children.length > 0 && (
              <span className="text-[11px] font-mono text-[var(--oa-text-muted)]">
                {language === "en"
                  ? `${node.children.length} sub-item${node.children.length > 1 ? "s" : ""}`
                  : `${node.children.length} sub-item`}
              </span>
            )}
          </div>

          <div
            className={`w-full prose ${theme === "dark" ? "prose-invert" : ""} max-w-none
              prose-p:text-[var(--oa-text-secondary)] prose-p:text-[13.5px] prose-p:leading-[1.65] prose-p:mb-3
              prose-a:text-[var(--oa-text-champagne)] hover:prose-a:text-[var(--oa-accent-champagne-bright)] prose-a:no-underline transition-colors
              prose-strong:text-[var(--oa-text-primary)] prose-strong:font-semibold
              prose-li:text-[var(--oa-text-secondary)] prose-li:text-[13.5px] prose-li:my-1
              prose-ul:pl-5 prose-ul:mb-4 prose-ol:pl-5 prose-ol:mb-4
              prose-headings:text-[var(--oa-text-primary)] prose-headings:font-semibold prose-h1:text-[15.5px] prose-h2:text-[15.5px] prose-h3:text-[14.5px]
              prose-hr:border-[var(--oa-border-subtle)] prose-hr:my-5
              prose-blockquote:border-l-2 prose-blockquote:border-[var(--oa-accent-champagne)] prose-blockquote:pl-4 prose-blockquote:text-[var(--oa-text-muted)]
            `}
          >
            {blocks.length === 0 ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {node.detail ||
                  (language === "en" ? "_No detail available._" : "_Tidak ada detail._")}
              </ReactMarkdown>
            ) : (
              <div className="space-y-3">
                {blocks.map((b, i) =>
                  b.kind === "bullets" ? (
                    <BulletTree key={i} items={b.items} nodeType={node.type} />
                  ) : (
                    <div key={i}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {b.md}
                      </ReactMarkdown>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {node.children.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] mb-2">
                {language === "en" ? "Sub-items" : "Sub-item"}
              </h3>
              <ul className="space-y-1.5">
                {node.children.map((c) => (
                  <li
                    key={c.id}
                    className="oa-recessed-well flex items-center gap-2 text-[12.5px] text-[var(--oa-text-secondary)] rounded-lg px-3 py-2"
                  >
                    {c.code && (
                      <span className="text-[10px] font-mono text-[var(--oa-text-champagne)] shrink-0">
                        {c.code}
                      </span>
                    )}
                    <span className="truncate">{c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {(onOpenDocument || onAddNote) && (
          <div className="shrink-0 px-5 py-3 border-t border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)] flex items-center justify-end gap-2">
            {onOpenDocument && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDocument();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--oa-border-default)] bg-[var(--oa-bg-elevated)] hover:border-[var(--oa-border-strong)] text-[12px] font-medium text-[var(--oa-text-primary)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                <FileText size={13} strokeWidth={1.6} aria-hidden="true" />
                <span>{language === "en" ? "Open Document" : "Buka Dokumen"}</span>
              </button>
            )}
            {onAddNote && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddNote(node.title);
                }}
                className="oa-bevel-cta inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                <MessageSquarePlus size={13} strokeWidth={1.75} aria-hidden="true" />
                <span>{t.sheet.addNote}</span>
              </button>
            )}
          </div>
        )}
      </motion.aside>
    </>
  );
}
