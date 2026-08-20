// Render satu section PRD (heading collapsible + konten markdown + aksi
// copy/feedback). Dipisah dari BlueprintSheet.tsx — murni props-driven,
// tidak menyentuh state milik parent (pure move, zero logic change).
import React, { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ClipboardCopy,
  MessageSquareText,
} from "lucide-react";
import type { Section } from "../utils/sections";
import type { WbsBulletItem } from "../utils/wbs";
import { parseBulletTree } from "../utils/wbs";
import { MermaidRenderer } from "./MermaidRenderer";

// Section "Feature Breakdown (WBS)" — bullet bersarang dirender sebagai TABEL
// 3 kolom (Modul/Fitur/Sub-fitur). Section lain tetap markdown biasa.
const WBS_SECTION_RE = /(feature\s+breakdown|work\s+breakdown|wbs|pohon\s+fitur|rincian\s+fitur)/i;
// WBS breakdown digenerate sbg `###` DI DALAM chapter (getSections hanya split
// `##`), jadi deteksi juga baris heading di konten, bukan hanya judul chapter.
const WBS_HEADER_RE = /^#{1,4}[^\n]*(?:feature\s+breakdown|work\s+breakdown|\bwbs\b|pohon\s+fitur|rincian\s+fitur)[^\n]*$/im;
const WBS_HEADING_STRIP_RE = /^#{1,4}\s*/;
const WBS_LINE_RE = /^\s*[-*•]\s+/;

// Pisahkan konten section sebelum heading WBS (tabel MoSCoW/prosa — render
// markdown biasa) vs bagian WBS (heading + bullet — render tabel).
function splitWbsSection(content: string): { before: string; heading: string; after: string } | null {
  const m = content.match(WBS_HEADER_RE);
  if (!m || typeof m.index !== "number") return null;
  return {
    before: content.slice(0, m.index),
    heading: m[0],
    after: content.slice(m.index + m[0].length),
  };
}

// Flatten pohon bullet → baris tabel. Satu baris per (module, feature, sub):
// - module = root depth 0, feature = depth 1, sub = gabungan seluruh turunan
//   depth 2+ (satu baris per sub); fitur tanpa sub → kolom sub kosong.
// - Breakdown flat tanpa module (root = fitur): kolom module = nama root,
//   feature = anaknya; root tanpa anak → module & feature = root itu sendiri.
export interface WbsRow {
  module: string;
  feature: string;
  sub: string;
}

export function wbsRows(items: WbsBulletItem[]): WbsRow[] {
  const rows: WbsRow[] = [];
  const collectDescendants = (node: WbsBulletItem, out: WbsBulletItem[]): void => {
    for (const c of node.children) {
      out.push(c);
      collectDescendants(c, out);
    }
  };
  for (const root of items) {
    if (root.children.length === 0) {
      // root = fitur tanpa anak → module & feature diisi root itu sendiri
      rows.push({ module: root.title, feature: root.title, sub: "" });
      continue;
    }
    for (const feature of root.children) {
      const subs: WbsBulletItem[] = [];
      collectDescendants(feature, subs);
      if (subs.length === 0) rows.push({ module: root.title, feature: feature.title, sub: "" });
      else for (const s of subs) rows.push({ module: root.title, feature: feature.title, sub: s.title });
    }
  }
  return rows;
}

// Flatten lanjutan untuk render tabel: grup berurutan (module / module+feature)
// di-merge vertikal via rowSpan. `null` pada module/feature = jangan render
// sel sama sekali (sudah tertutup rowSpan baris pertama grup).
export interface WbsTableRow {
  module: string | null;
  moduleSpan?: number;
  feature: string | null;
  featureSpan?: number;
  sub: string;
}

export function wbsTableRows(rows: WbsRow[]): WbsTableRow[] {
  const out: WbsTableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const module = rows[i].module;
    let moduleEnd = i + 1;
    while (moduleEnd < rows.length && rows[moduleEnd].module === module) moduleEnd++;
    for (let k = i; k < moduleEnd; ) {
      const feature = rows[k].feature;
      let featureEnd = k + 1;
      while (featureEnd < moduleEnd && rows[featureEnd].feature === feature) featureEnd++;
      // Satu baris per sub-row; feature hanya di baris pertama run-nya.
      for (let j = k; j < featureEnd; j++) {
        out.push({
          module: j === i ? module : null,
          moduleSpan: j === i ? moduleEnd - i : undefined,
          feature: j === k ? feature : null,
          featureSpan: j === k ? featureEnd - k : undefined,
          sub: rows[j].sub,
        });
      }
      k = featureEnd;
    }
    i = moduleEnd;
  }
  return out;
}

// Prosa/catatan non-bullet SETELAH blok bullet — tidak boleh hilang; dirender
// sebagai markdown di bawah tabel.
function wbsTailNote(content: string): string {
  let lastBullet = -1;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (WBS_LINE_RE.test(lines[i])) lastBullet = i;
  }
  if (lastBullet < 0) return "";
  return lines
    .slice(lastBullet + 1)
    .filter((l) => l.trim())
    .join("\n");
}

function WbsSectionView({ heading, content, language, markdownComponents }: { heading: string; content: string; language: "id" | "en"; markdownComponents: Components }) {
  const items = useMemo(() => parseBulletTree(content), [content]);
  const rows = useMemo(() => wbsTableRows(wbsRows(items)), [items]);
  const tailNote = useMemo(() => wbsTailNote(content), [content]);
  const headers = language === "en" ? ["Module", "Feature", "Sub-feature"] : ["Modul", "Fitur", "Sub-fitur"];
  return (
    <div className="w-full">
      <div className="mb-3 mt-4">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] print:text-black">
          {heading.replace(WBS_HEADING_STRIP_RE, "").trim()}
        </span>
      </div>
      {items.length === 0 ? (
        // Fallback aman: kalau tidak ada bullet, render markdown biasa — konten tidak hilang.
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      ) : (
        <>
          <div className="w-full overflow-x-auto my-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 print:border-gray-300 print:bg-transparent">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border-b border-[var(--color-border)] print:bg-gray-100 print:text-black">
                <tr>
                  {headers.map((h, hidx) => (
                    <th key={h} className={`px-4 py-2.5 font-semibold whitespace-nowrap text-[12px] text-[var(--color-text-primary)] text-left align-middle ${hidx < 2 ? "border-r border-[var(--color-border)] print:border-gray-300" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] print:divide-gray-200">
                {rows.map((r, i) => (
                  <tr key={i}>
                    {r.module !== null && (
                      <td rowSpan={r.moduleSpan ?? 1} className="px-4 py-2.5 align-middle leading-relaxed text-[var(--color-text-primary)] font-medium print:text-black min-w-[120px] text-[13px] text-left border-r border-[var(--color-border)] print:border-gray-300">
                        {r.module}
                      </td>
                    )}
                    {r.feature !== null && (
                      <td rowSpan={r.featureSpan ?? 1} className="px-4 py-2.5 align-middle leading-relaxed text-[var(--color-text-secondary)] print:text-black min-w-[120px] text-[13px] text-left border-r border-[var(--color-border)] print:border-gray-300">
                        {r.feature}
                      </td>
                    )}
                    <td className="px-4 py-2.5 align-middle leading-relaxed text-[var(--color-text-secondary)] print:text-black min-w-[120px] text-[13px] text-left">
                      {r.sub}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tailNote && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {tailNote}
            </ReactMarkdown>
          )}
        </>
      )}
    </div>
  );
}

export const SheetSection = memo(function SheetSection({
  section,
  sectionId,
  index,
  total,
  isCollapsed,
  onToggleCollapse,
  isGenerating,
  language,
  onOpenFeedback,
}: {
  section: Section;
  sectionId: string;
  index: number;
  total: number;
  isCollapsed: boolean;
  onToggleCollapse: (sectionId: string) => void;
  isGenerating?: boolean;
  language: "id" | "en";
  onOpenFeedback: () => void;
}) {

  const copySection = async () => {
    try {
      await navigator.clipboard.writeText(section.heading + "\n\n" + section.content);
    } catch {
      // Clipboard write failed — silently ignore in section context
    }
  };

  const wbs = useMemo(() => splitWbsSection(section.content), [section.content]);
  const isWbsSection = WBS_SECTION_RE.test(section.heading) || wbs !== null;

  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
          {children}
        </a>
      ),
      h2: () => null,
      h3: ({ node, children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { node?: unknown }) => (
        <h3 className="relative text-[16px] font-semibold text-[var(--color-text-primary)] mt-6 mb-3 tracking-tight" {...props}>
          {children}
        </h3>
      ),
      table: ({ node, ...props }: React.HTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
        <div className="w-full overflow-x-auto my-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 print:border-gray-300 print:bg-transparent">
          <table className="w-full text-[13px] text-left border-collapse" {...props} />
        </div>
      ),
      thead: ({ node, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
        <thead className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border-b border-[var(--color-border)] print:bg-gray-100 print:text-black" {...props} />
      ),
      th: ({ node, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
        <th className="px-4 py-2.5 font-semibold whitespace-nowrap text-[12px] text-[var(--color-text-primary)]" {...props} />
      ),
      tbody: ({ node, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
        <tbody className="divide-y divide-[var(--color-border)] print:divide-gray-200" {...props} />
      ),
      td: ({ node, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
        <td className="px-4 py-2.5 align-top leading-relaxed text-[var(--color-text-secondary)] print:text-black min-w-[120px] text-[13px]" {...props} />
      ),
      pre: ({ node, children, ...props }: { node?: unknown; children?: React.ReactNode }) => {
        const firstChild = (node as { children?: Array<{ properties?: { className?: string[] } }> } | undefined)?.children?.[0];
        const isMermaid = firstChild?.properties?.className?.includes("language-mermaid");
        if (isMermaid) {
          return <>{children}</>;
        }
        return (
          <div className="relative my-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
            <pre className="p-4 overflow-x-auto m-0 bg-transparent text-[13px] font-mono text-[var(--color-text-primary)] print:text-black" {...props}>
              {children}
            </pre>
          </div>
        );
      },
      code: ({ node, className, children, ...props }: { node?: unknown; className?: string; children?: React.ReactNode }) => {
        const match = /language-(\w+)/.exec(className || "");
        if (match?.[1] === "mermaid") {
          const raw = Array.isArray(children)
            ? children.filter((c) => typeof c === "string").join("")
            : typeof children === "string"
              ? children
              : String(children ?? "");
          const chartStr = raw.replace(/[\r\n]+$/, "");
          return <MermaidRenderer chart={chartStr} isGenerating={isGenerating} />;
        }
        const isInline = !match && !String(children).includes("\n");
        if (isInline) {
          return (
            <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[12px] font-mono text-[var(--color-interactive)]" {...props}>
              {children}
            </code>
          );
        }
        return (
          <code className={`font-mono text-[13px] text-[var(--color-text-primary)] ${className || ""}`} {...props}>
            {children}
          </code>
        );
      },
    }),
    [isGenerating],
  );

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-card transition-all duration-200 hover:border-[var(--color-border-hover)]">
      {/* Header — click to collapse */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)] cursor-pointer select-none transition-colors no-print focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none ${isCollapsed ? 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)]/50' : 'bg-[var(--color-surface-elevated)]/40 hover:bg-[var(--color-surface-elevated)]/70'}`}
        onClick={() => onToggleCollapse(sectionId)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(sectionId); } }}
        aria-expanded={!isCollapsed}
        aria-controls={`section-content-${sectionId}`}
      >
        <div className="flex items-center gap-2.5">
          <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-[var(--color-text-primary)] text-[14px] font-semibold" id={`${sectionId}-heading`}>{section.heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--color-text-muted)] px-2 py-0.5 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">{index + 1}/{total}</span>
        </div>
      </div>

      {/* Content — collapsible */}
      <div id={`section-content-${sectionId}`} className="grid transition-[grid-template-rows] duration-200 ease-out print:max-h-none" style={{ gridTemplateRows: isCollapsed ? '0fr' : '1fr' }} role="region">
        <div className="overflow-hidden">
          <div className="px-6 py-5">
            <div
              id={`${sectionId}-content`}
              className="w-full prose prose-invert max-w-none
                prose-headings:font-semibold prose-headings:text-[var(--color-text-primary)]
                prose-h2:hidden
                prose-h3:text-[16px] prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-[var(--color-text-secondary)] prose-p:text-[14px] prose-p:leading-[1.65] prose-p:mb-3.5
                prose-a:text-[var(--color-interactive)] hover:prose-a:text-[var(--color-interactive-hover)] prose-a:no-underline transition-colors
                prose-li:text-[var(--color-text-secondary)] prose-li:text-[14px] prose-li:my-1
                prose-strong:text-[var(--color-text-primary)] prose-strong:font-semibold
                prose-ul:pl-5 prose-ul:mb-4 prose-ol:pl-5 prose-ol:mb-4
                prose-hr:border-[var(--color-border)] prose-hr:my-6
                prose-blockquote:border-l-2 prose-blockquote:border-[var(--color-interactive)] prose-blockquote:pl-4 prose-blockquote:text-[var(--color-text-muted)]
                print:prose-p:text-black print:prose-li:text-black print:prose-headings:text-black print:prose-strong:text-black
              "
            >
              {isWbsSection ? (
                <>
                  {wbs && wbs.before.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {wbs.before}
                    </ReactMarkdown>
                  ) : null}
                  <WbsSectionView
                    heading={wbs ? wbs.heading : section.heading}
                    content={wbs ? wbs.after : section.content}
                    language={language}
                    markdownComponents={markdownComponents}
                  />
                </>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {section.content}
                </ReactMarkdown>
              )}
            </div>
          </div>

          {/* Footer — actions */}
          <div className="flex items-center justify-end gap-2 px-5 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 no-print">
            <button
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--color-surface-elevated)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
              onClick={copySection}
              aria-label={language === "en" ? "Copy section" : "Salin bagian"}
            >
              <ClipboardCopy size={13} strokeWidth={1.5} /> {language === "en" ? "Copy" : "Salin"}
            </button>
            <button
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--color-surface-elevated)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
              onClick={onOpenFeedback}
              aria-label={language === "en" ? "Open feedback" : "Buka umpan balik"}
            >
              <MessageSquareText size={13} strokeWidth={1.5} /> {language === "en" ? "Feedback" : "Umpan Balik"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});