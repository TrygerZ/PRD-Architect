// Renders a single PRD section (collapsible heading, markdown/WBS/Mermaid body, and inline revision note).
import React, { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ClipboardCopy,
  Check,
  MessageSquarePlus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Section } from "../utils/sections";
import type { ThemeMode } from "../utils/theme";
import { parseBulletTree } from "../utils/wbs";
import {
  WBS_HEADING_STRIP_RE,
  WBS_SECTION_RE,
  splitWbsSection,
  wbsRows,
  wbsTableRows,
  wbsTailNote,
} from "../utils/wbsTable";
import { useT } from "../hooks/useT";
import { MermaidRenderer } from "./MermaidRenderer";

export interface SheetSectionProps {
  section: Section;
  sectionId: string;
  index: number;
  total: number;
  isCollapsed: boolean;
  onToggleCollapse: (sectionId: string) => void;
  isGenerating?: boolean;
  language: "id" | "en";
  theme: ThemeMode;
  comment: string;
  onCommentChange?: (sectionId: string, comment: string) => void;
  isStreamingSection?: boolean;
}

const REMARK_PLUGINS = [remarkGfm];

interface MarkdownRenderContextValue {
  isGenerating?: boolean;
  theme: ThemeMode;
  language: "id" | "en";
}

const MarkdownRenderContext = createContext<MarkdownRenderContextValue>({
  isGenerating: false,
  theme: "dark",
  language: "id",
});

function MarkdownCode({
  node: _node,
  className,
  children,
  ...props
}: {
  node?: unknown;
  className?: string;
  children?: React.ReactNode;
}) {
  const { isGenerating, theme, language } = useContext(MarkdownRenderContext);
  const match = /language-(\w+)/.exec(className || "");
  if (match?.[1] === "mermaid") {
    const raw = Array.isArray(children)
      ? children.filter((c) => typeof c === "string").join("")
      : typeof children === "string"
        ? children
        : String(children ?? "");
    const chartStr = raw.replace(/[\r\n]+$/, "");
    return (
      <MermaidRenderer
        chart={chartStr}
        isGenerating={isGenerating}
        theme={theme}
        language={language}
      />
    );
  }
  const isInline = !match && !String(children).includes("\n");
  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[12px] font-mono text-[var(--oa-text-champagne)] print:bg-gray-100 print:text-black"
        {...props}
      >
        {children}
      </code>
    );
  }
  return (
    <code
      className={`font-mono text-[12.5px] text-[var(--oa-text-primary)] ${className || ""}`}
      {...props}
    >
      {children}
    </code>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
      {children}
    </a>
  ),
  h2: () => null,
  h3: ({ node: _node, children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { node?: unknown }) => (
    <h3
      className="relative text-[15.5px] font-semibold text-[var(--oa-text-primary)] mt-6 mb-2.5 tracking-tight print:text-black"
      {...props}
    >
      {children}
    </h3>
  ),
  table: ({ node: _node, ...props }: React.HTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
    <div className="w-full overflow-x-auto my-5 rounded-xl border border-[var(--oa-border-default)] bg-[var(--oa-bg-surface)] print:border-gray-300 print:bg-transparent">
      <table className="w-full text-[13px] text-left border-collapse" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
    <thead
      className="bg-[var(--oa-bg-recessed)] text-[var(--oa-text-primary)] border-b border-[var(--oa-border-default)] print:bg-gray-100 print:text-black"
      {...props}
    />
  ),
  th: ({ node: _node, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
    <th
      className="px-4 py-2.5 font-mono font-semibold whitespace-nowrap text-[11px] uppercase tracking-[0.06em] text-[var(--oa-text-muted)] print:text-black"
      {...props}
    />
  ),
  tbody: ({ node: _node, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { node?: unknown }) => (
    <tbody
      className="divide-y divide-[var(--oa-border-default)] print:divide-gray-200"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { node?: unknown }) => (
    <td
      className="px-4 py-2.5 align-top leading-relaxed text-[var(--oa-text-secondary)] print:text-black min-w-[120px] text-[13px]"
      {...props}
    />
  ),
  pre: ({ node, children, ...props }: { node?: unknown; children?: React.ReactNode }) => {
    const firstChild = (
      node as { children?: Array<{ properties?: { className?: string[] } }> } | undefined
    )?.children?.[0];
    const isMermaid = firstChild?.properties?.className?.includes("language-mermaid");
    if (isMermaid) {
      return <>{children}</>;
    }
    return (
      <div className="oa-recessed-well relative my-5 rounded-xl overflow-hidden">
        <pre
          className="p-4 overflow-x-auto m-0 bg-transparent text-[12.5px] font-mono text-[var(--oa-text-primary)] print:text-black"
          {...props}
        >
          {children}
        </pre>
      </div>
    );
  },
  code: MarkdownCode,
};

function WbsSectionView({
  heading,
  content,
  language,
  markdownComponents,
}: {
  heading: string;
  content: string;
  language: "id" | "en";
  markdownComponents: Components;
}) {
  const items = useMemo(() => parseBulletTree(content), [content]);
  const rows = useMemo(() => wbsTableRows(wbsRows(items)), [items]);
  const tailNote = useMemo(() => wbsTailNote(content), [content]);
  const headers =
    language === "en"
      ? ["MODULE", "FEATURE", "SUB-FEATURE"]
      : ["MODUL", "FITUR", "SUB-FITUR"];

  return (
    <div className="w-full">
      <div className="mb-3 mt-4">
        <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] print:text-black">
          {heading.replace(WBS_HEADING_STRIP_RE, "").trim()}
        </span>
      </div>
      {items.length === 0 ? (
        // Fallback aman: kalau tidak ada bullet, render markdown biasa — konten tidak hilang.
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      ) : (
        <>
          <div className="w-full overflow-x-auto my-5 rounded-xl border border-[var(--oa-border-default)] bg-[var(--oa-bg-surface)] print:border-gray-300 print:bg-transparent">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead className="bg-[var(--oa-bg-recessed)] border-b border-[var(--oa-border-default)] print:bg-gray-100 print:text-black">
                <tr>
                  {headers.map((h, hidx) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 font-mono font-semibold whitespace-nowrap text-[11px] uppercase tracking-[0.06em] text-[var(--oa-text-muted)] text-left align-middle print:text-black ${
                        hidx < 2
                          ? "border-r border-[var(--oa-border-default)] print:border-gray-300"
                          : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--oa-border-default)] print:divide-gray-200">
                {rows.map((r, i) => (
                  <tr key={i}>
                    {r.module !== null && (
                      <td
                        rowSpan={r.moduleSpan ?? 1}
                        className="px-4 py-2.5 align-middle leading-relaxed text-[var(--oa-text-primary)] font-medium print:text-black min-w-[120px] text-[13px] text-left border-r border-[var(--oa-border-default)] print:border-gray-300"
                      >
                        {r.module}
                      </td>
                    )}
                    {r.feature !== null && (
                      <td
                        rowSpan={r.featureSpan ?? 1}
                        className="px-4 py-2.5 align-middle leading-relaxed text-[var(--oa-text-secondary)] print:text-black min-w-[120px] text-[13px] text-left border-r border-[var(--oa-border-default)] print:border-gray-300"
                      >
                        {r.feature}
                      </td>
                    )}
                    <td className="px-4 py-2.5 align-middle leading-relaxed text-[var(--oa-text-secondary)] print:text-black min-w-[120px] text-[13px] text-left">
                      {r.sub}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tailNote && (
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
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
  theme,
  comment,
  onCommentChange,
  isStreamingSection = false,
}: SheetSectionProps) {
  const t = useT(language);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(comment);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setDraftNote(comment);
    if (!comment.trim()) {
      setIsEditingNote(false);
    }
  }, [comment]);

  useEffect(() => {
    return () => {
      clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const copySection = async () => {
    try {
      await navigator.clipboard.writeText(`${section.heading}\n\n${section.content}`);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard write failed — silently ignore in section context
    }
  };

  const handleSaveNote = () => {
    onCommentChange?.(sectionId, draftNote.trim());
    setIsEditingNote(false);
  };

  const handleCancelNote = () => {
    setDraftNote(comment);
    setIsEditingNote(false);
  };

  const handleClearNote = () => {
    setDraftNote("");
    setIsEditingNote(false);
    onCommentChange?.(sectionId, "");
  };

  const wbs = useMemo(() => splitWbsSection(section.content), [section.content]);
  const isWbsSection = WBS_SECTION_RE.test(section.heading) || wbs !== null;

  const renderContext = useMemo<MarkdownRenderContextValue>(
    () => ({ isGenerating, theme, language }),
    [isGenerating, theme, language],
  );

  const hasSavedComment = comment.trim().length > 0;
  const zeroIndex = String(index + 1).padStart(2, "0");

  return (
    <div
      className={`oa-elev-sheet rounded-2xl overflow-hidden transition-colors hover:border-[var(--oa-border-strong)] ${
        hasSavedComment ? "border-[var(--oa-border-champagne)]/70" : ""
      }`}
    >
      {/* Header - click to collapse */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)] hover:bg-[var(--oa-bg-hover)]/35 cursor-pointer select-none transition-colors no-print focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
        onClick={() => onToggleCollapse(sectionId)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleCollapse(sectionId);
          }
        }}
        aria-expanded={!isCollapsed}
        aria-controls={`section-content-${sectionId}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown
            className={`w-4 h-4 text-[var(--oa-text-muted)] shrink-0 transition-transform duration-150 ${
              isCollapsed ? "-rotate-90" : ""
            }`}
            strokeWidth={1.6}
            aria-hidden="true"
          />
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[10.5px] font-mono text-[var(--oa-text-champagne)] shrink-0">
            {zeroIndex}
          </span>
          <h2
            className="text-[var(--oa-text-primary)] text-[14px] font-semibold truncate"
            id={`${sectionId}-heading`}
          >
            {section.heading}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasSavedComment && (
            <span
              className="w-2 h-2 rounded-full bg-[var(--oa-accent-champagne)]"
              title={t.sheet.noteSaved}
              aria-label={t.sheet.noteSaved}
            />
          )}
          <span className="text-[11px] font-mono text-[var(--oa-text-muted)] px-2 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)]">
            {index + 1}/{total}
          </span>
        </div>
      </div>

      {/* Content - collapsible */}
      <div
        id={`section-content-${sectionId}`}
        className="grid transition-[grid-template-rows] duration-200 ease-out print:max-h-none"
        style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}
        role="region"
      >
        <div className="overflow-hidden">
          <div className="px-5 sm:px-6 py-5">
            <div
              id={`${sectionId}-content`}
              className={`w-full prose ${theme === "dark" ? "prose-invert" : ""} max-w-none
                prose-headings:font-semibold prose-headings:text-[var(--oa-text-primary)]
                prose-h2:hidden
                prose-h3:text-[15.5px] prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-[var(--oa-text-secondary)] prose-p:text-[14px] prose-p:leading-[1.68] prose-p:mb-3.5
                prose-a:text-[var(--oa-text-champagne)] hover:prose-a:text-[var(--oa-accent-champagne-bright)] prose-a:no-underline transition-colors
                prose-li:text-[var(--oa-text-secondary)] prose-li:text-[14px] prose-li:my-1
                prose-strong:text-[var(--oa-text-primary)] prose-strong:font-semibold
                prose-ul:pl-5 prose-ul:mb-4 prose-ol:pl-5 prose-ol:mb-4
                prose-hr:border-[var(--oa-border-subtle)] prose-hr:my-6
                prose-blockquote:border-l-2 prose-blockquote:border-[var(--oa-accent-champagne)] prose-blockquote:pl-4 prose-blockquote:text-[var(--oa-text-muted)]
                print:prose-p:text-black print:prose-li:text-black print:prose-headings:text-black print:prose-strong:text-black
              `}
            >
              <MarkdownRenderContext.Provider value={renderContext}>
                {isWbsSection ? (
                  <>
                    {wbs && wbs.before.trim() ? (
                      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                        {wbs.before}
                      </ReactMarkdown>
                    ) : null}
                    <WbsSectionView
                      heading={wbs ? wbs.heading : section.heading}
                      content={wbs ? wbs.after : section.content}
                      language={language}
                      markdownComponents={MARKDOWN_COMPONENTS}
                    />
                  </>
                ) : (
                  <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                    {section.content}
                  </ReactMarkdown>
                )}
              </MarkdownRenderContext.Provider>

              {isStreamingSection && (
                <div className="mt-2 flex items-center gap-2 no-print">
                  <span
                    className="inline-block w-[2px] h-4 align-middle bg-[var(--oa-accent-champagne)] animate-pulse ml-1"
                    aria-hidden="true"
                  />
                  <span className="text-[10.5px] font-mono text-[var(--oa-text-champagne)]">
                    {t.sheet.streamingChapter}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer - inline copy and revision note UX */}
          <div className="px-5 py-3 border-t border-[var(--oa-border-subtle)] bg-[var(--oa-bg-recessed)]/35 no-print">
            {isEditingNote ? (
              <div className="oa-elev-sheet rounded-xl border-[var(--oa-border-champagne)] p-3 space-y-2.5">
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleSaveNote();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelNote();
                    }
                  }}
                  placeholder={
                    language === "en"
                      ? "Add revision note for this chapter..."
                      : "Tambahkan catatan revisi untuk chapter ini..."
                  }
                  className="w-full min-h-[76px] p-2.5 rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-default)] focus:border-[var(--oa-border-champagne)] outline-none text-[12px] font-mono text-[var(--oa-text-primary)] placeholder:text-[var(--oa-text-muted)] resize-y"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelNote}
                    className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  >
                    {t.builder.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="oa-bevel-cta px-3 py-1 rounded-lg text-[11.5px] font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  >
                    {language === "en" ? "Save" : "Simpan"}
                  </button>
                </div>
              </div>
            ) : hasSavedComment ? (
              <div className="oa-elev-sheet rounded-xl border-[var(--oa-border-champagne)] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--oa-signal-sage-tint)] border border-[var(--oa-signal-sage)]/30 text-[10.5px] font-mono text-[var(--oa-signal-sage)]">
                    <Check size={11} strokeWidth={2} aria-hidden="true" />
                    <span>{t.sheet.noteSaved}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={copySection}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                    >
                      {copied ? (
                        <Check
                          size={12}
                          strokeWidth={1.8}
                          className="text-[var(--oa-signal-sage)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <ClipboardCopy size={12} strokeWidth={1.5} aria-hidden="true" />
                      )}
                      <span>{copied ? t.mermaid.copied : t.sheet.copySection}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDraftNote(comment);
                        setIsEditingNote(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--oa-text-champagne)] hover:bg-[var(--oa-accent-champagne-tint)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                    >
                      <Pencil size={11} strokeWidth={1.6} aria-hidden="true" />
                      <span>{t.sheet.editNote}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearNote}
                      aria-label={t.sheet.clearNote}
                      title={t.sheet.clearNote}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--oa-text-muted)] hover:text-[var(--oa-signal-garnet)] hover:bg-[var(--oa-signal-garnet-tint)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                    >
                      <Trash2 size={11} strokeWidth={1.6} aria-hidden="true" />
                      <span>{t.sheet.clearNote}</span>
                    </button>
                  </div>
                </div>
                <p className="text-[12px] font-mono text-[var(--oa-text-secondary)] whitespace-pre-wrap leading-relaxed">
                  {comment}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={copySection}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                >
                  {copied ? (
                    <Check
                      size={12}
                      strokeWidth={1.8}
                      className="text-[var(--oa-signal-sage)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <ClipboardCopy size={12} strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span>{copied ? t.mermaid.copied : t.sheet.copySection}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftNote(comment);
                    setIsEditingNote(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] text-[var(--oa-text-muted)] hover:text-[var(--oa-text-champagne)] hover:bg-[var(--oa-accent-champagne-tint)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                >
                  <MessageSquarePlus size={12} strokeWidth={1.5} aria-hidden="true" />
                  <span>{t.sheet.addNote}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, areSheetSectionPropsEqual);

function areSheetSectionPropsEqual(
  prev: Readonly<SheetSectionProps>,
  next: Readonly<SheetSectionProps>,
): boolean {
  return (
    prev.section.heading === next.section.heading &&
    prev.section.content === next.section.content &&
    prev.sectionId === next.sectionId &&
    prev.index === next.index &&
    prev.total === next.total &&
    prev.isCollapsed === next.isCollapsed &&
    prev.isGenerating === next.isGenerating &&
    prev.isStreamingSection === next.isStreamingSection &&
    prev.language === next.language &&
    prev.theme === next.theme &&
    prev.comment === next.comment &&
    prev.onToggleCollapse === next.onToggleCollapse &&
    prev.onCommentChange === next.onCommentChange
  );
}
