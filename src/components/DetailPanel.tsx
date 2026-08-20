import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Box } from "lucide-react";
import type { WbsNode, WbsBulletItem } from "../utils/wbs";
import { parseBulletTree } from "../utils/wbs";

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  "Must-have": { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  "Should-have": { badge: "bg-sky-500/10 text-sky-400 border-sky-500/30", dot: "bg-sky-400" },
  "Could-have": { badge: "bg-amber-500/10 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  "Won't-have": { badge: "bg-slate-500/10 text-slate-400 border-slate-500/30", dot: "bg-slate-400" },
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
// tipe, level 2+ = baris chip + judul, indent bergeser per level.
// Pakai div (bukan ul/li) agar tidak kena styling prose; role untuk a11y.
function BulletTree({ items, depth = 0, nodeType }: { items: WbsBulletItem[]; depth?: number; nodeType: WbsNode["type"] }) {
  return (
    <div role="list" className={depth === 0 ? "space-y-1.5" : "mt-1 space-y-1"} style={depth > 0 ? { marginLeft: 16 } : undefined}>
      {items.map((item, i) => (
        <div key={i} role="listitem">
          {depth === 0 ? (
            <div className="flex items-center gap-2 py-1.5 border-b border-[var(--color-border)]/70">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-snug">{item.title}</span>
              <span className="text-[10px] font-mono uppercase tracking-wide text-[var(--color-text-muted)] px-1.5 py-0.5 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shrink-0">
                {nodeType}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/30">
              <span className="text-[10px] font-mono text-[var(--color-interactive)] shrink-0" aria-hidden="true">
                {"·".repeat(Math.min(depth, 3))}
              </span>
              <span className="text-[13px] text-[var(--color-text-secondary)] leading-snug">{item.title}</span>
            </div>
          )}
          {item.children.length > 0 && <BulletTree items={item.children} depth={depth + 1} nodeType={nodeType} />}
        </div>
      ))}
    </div>
  );
}

interface DetailPanelProps {
  node: WbsNode;
  language: "id" | "en";
  onClose: () => void;
}

export function DetailPanel({ node, language, onClose }: DetailPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const priorityStyle = node.priority ? PRIORITY_STYLES[node.priority] : undefined;

  const blocks = useMemo(() => splitDetailBlocks(node.detail), [node.detail]);

  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
          {children}
        </a>
      ),
      table: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
        <div className="w-full overflow-x-auto my-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 print:border-gray-300 print:bg-transparent">
          <table className="w-full text-[13px] text-left border-collapse" {...props} />
        </div>
      ),
      thead: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
        <thead className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border-b border-[var(--color-border)] print:bg-gray-100 print:text-black" {...props} />
      ),
      th: ({ node: _n, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
        <th className="px-4 py-2.5 font-semibold whitespace-nowrap text-[12px] text-[var(--color-text-primary)]" {...props} />
      ),
      tbody: ({ node: _n, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
        <tbody className="divide-y divide-[var(--color-border)] print:divide-gray-200" {...props} />
      ),
      td: ({ node: _n, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
        <td className="px-4 py-2.5 align-top leading-relaxed text-[var(--color-text-secondary)] print:text-black min-w-[120px] text-[13px]" {...props} />
      ),
      pre: ({ children }: { children?: React.ReactNode }) => (
        <pre className="p-3 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[12px] font-mono text-[var(--color-text-primary)]">
          {children}
        </pre>
      ),
    }),
    [],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        aria-hidden="true"
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={language === "en" ? "Node detail" : "Detail node"}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] sm:max-w-[90vw] z-[65] bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-floating flex flex-col"
      >
        {/* TODO(a11y): focus trap penuh + restore focus ke node asal saat close */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center text-[var(--color-text-secondary)] shrink-0">
              <Box size={14} strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
              {node.code || node.id}
            </span>
          </div>
          <button
            autoFocus
            onClick={onClose}
            aria-label={language === "en" ? "Close detail panel" : "Tutup panel detail"}
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer shrink-0"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)] tracking-tight leading-snug mb-2">
            {node.title}
          </h2>

          <div className="flex items-center gap-2 mb-4">
            {node.priority && priorityStyle ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${priorityStyle.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                {node.priority}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[11px] font-mono text-[var(--color-text-muted)]">
                {node.type}
              </span>
            )}
            {node.children.length > 0 && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {language === "en"
                  ? `${node.children.length} sub-item${node.children.length > 1 ? "s" : ""}`
                  : `${node.children.length} sub-item`}
              </span>
            )}
          </div>

          <div
            className="w-full prose prose-invert max-w-none
              prose-p:text-[var(--color-text-secondary)] prose-p:text-[14px] prose-p:leading-[1.65] prose-p:mb-3
              prose-a:text-[var(--color-interactive)] hover:prose-a:text-[var(--color-interactive-hover)] prose-a:no-underline transition-colors
              prose-strong:text-[var(--color-text-primary)] prose-strong:font-semibold
              prose-li:text-[var(--color-text-secondary)] prose-li:text-[14px] prose-li:my-1
              prose-ul:pl-5 prose-ul:mb-4 prose-ol:pl-5 prose-ol:mb-4
              prose-headings:text-[var(--color-text-primary)] prose-headings:font-semibold prose-h1:text-[16px] prose-h2:text-[16px] prose-h3:text-[15px]
              prose-hr:border-[var(--color-border)] prose-hr:my-5
              prose-blockquote:border-l-2 prose-blockquote:border-[var(--color-interactive)] prose-blockquote:pl-4 prose-blockquote:text-[var(--color-text-muted)]
            "
          >
            {blocks.length === 0 ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {node.detail || (language === "en" ? "_No detail available._" : "_Tidak ada detail._")}
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
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                {language === "en" ? "Sub-items" : "Sub-item"}
              </h3>
              <ul className="space-y-1.5">
                {node.children.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)] rounded-lg px-3 py-2"
                  >
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] shrink-0">
                      {c.code || ""}
                    </span>
                    <span className="truncate">{c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}