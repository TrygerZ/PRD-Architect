import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  GitBranch,
  RefreshCw,
  ChevronDown,
  MessageSquareText,
  X,
  ClipboardCopy,
  GitCompare,
  Layers,
  Sparkles
} from "lucide-react";
import { PRDVersion, PRDMode } from "../types";
import { formatDate } from "../utils/format";
import { MermaidRenderer } from "./MermaidRenderer";
import { getSections, type Section } from "../utils/sections";
import { estimateTokens, formatTokenCount } from "../utils/tokens";

export { getSections } from "../utils/sections";

interface BlueprintSheetProps {
  content: string; // active version content
  comments?: Record<string, string>;
  onCommentChange?: (sectionId: string, comment: string) => void;
  versions?: PRDVersion[];
  activeVersionId?: string | null;
  onSwitchVersion?: (versionId: string) => void;
  onRevise?: () => void;
  isGenerating?: boolean;
  language: "id" | "en";
  onConvertMode?: (mode: PRDMode) => void;
  onCompareVersions?: () => void;
}

export const BlueprintSheet = memo(function BlueprintSheet({
  content,
  comments = {},
  onCommentChange,
  versions = [],
  activeVersionId,
  onSwitchVersion,
  onRevise,
  isGenerating,
  language,
  onConvertMode,
  onCompareVersions,
}: BlueprintSheetProps) {
  const sections = useMemo(() => getSections(content), [content]);
  const totalComments = Object.values(comments).filter(
    (c) => c.trim().length > 0,
  ).length;

  const [isFeedbackDrawerOpen, setIsFeedbackDrawerOpen] = useState(false);
  const [collapsedStates, setCollapsedStates] = useState<Record<string, boolean>>({});

  // Close drawers on click outside or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFeedbackDrawerOpen) setIsFeedbackDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFeedbackDrawerOpen]);

  // Focus trap for feedback drawer (A11Y-03)
  useEffect(() => {
    if (!isFeedbackDrawerOpen) return;

    const drawer = document.querySelector('[data-feedback-drawer]');
    if (!drawer) return;

    const focusableElements = drawer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabTrap);
    firstFocusable?.focus();

    return () => document.removeEventListener('keydown', handleTabTrap);
  }, [isFeedbackDrawerOpen]);

  const activeVersion = versions.find(v => v.id === activeVersionId) || versions[versions.length - 1];
  const activeVersionIndex = activeVersion ? versions.findIndex(v => v.id === activeVersion.id) : 0;

  const totalSections = sections.length;
  const isComplete = content.length > 0 && !isGenerating;
  const showProgress = content.length > 0;
  const expectedSections = { simple: 6, business: 12, technical: 9 }[activeVersion?.prdMode ?? "business"] ?? 12;
  const progress = isComplete
    ? 100
    : (isGenerating && content.length > 0
        ? Math.min(95, Math.max(5, Math.round((totalSections / expectedSections) * 100)))
        : 0);

  const handleToggleCollapse = useCallback((sectionId: string) => {
    setCollapsedStates(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  }, []);

  const handleOpenFeedback = useCallback(() => {
    setIsFeedbackDrawerOpen(true);
  }, []);

  return (
    <div className="w-full mx-auto relative z-10 print:block print:w-full print:max-w-full print:bg-white print:text-black">
      {/* Hidden container for full PRD print export */}
      <div id="prd-print-only" style={{ display: "none" }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>

      {/* Floating Action Button for Feedback */}
      <button
        onClick={() => setIsFeedbackDrawerOpen(!isFeedbackDrawerOpen)}
        className={`fixed bottom-[130px] sm:bottom-[90px] right-[20px] sm:right-[32px] z-[50] w-[44px] h-[44px] rounded-xl flex items-center justify-center transition-all duration-200 no-print cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none ${
          isFeedbackDrawerOpen
            ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-none"
            : "bg-[var(--color-interactive)] hover:bg-[var(--color-interactive-hover)] text-white shadow-floating"
        }`}
        aria-label={language === "en" ? (isFeedbackDrawerOpen ? "Close feedback" : "Open feedback") : (isFeedbackDrawerOpen ? "Tutup umpan balik" : "Buka umpan balik")}
      >
        {isFeedbackDrawerOpen ? (
          <X size={18} strokeWidth={1.5} />
        ) : (
          <div className="relative">
            <MessageSquareText size={18} strokeWidth={1.5} />
            {totalComments > 0 && (
              <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-error)]" />
            )}
          </div>
        )}
      </button>

      {/* Slide-in Feedback Drawer */}
      <div
        data-feedback-drawer
        role="dialog"
        aria-label={language === "en" ? "Feedback panel" : "Panel umpan balik"}
        className={`fixed top-13 right-0 bottom-0 w-full sm:w-[420px] sm:max-w-[100vw] bg-[var(--color-surface)] border-l border-[var(--color-border)] z-[45] transition-transform duration-200 ease-out overflow-y-auto overscroll-contain no-print shadow-floating ${
          isFeedbackDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-5 pb-24">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center text-[var(--color-text-secondary)]">
                <MessageSquareText size={15} strokeWidth={1.5} />
              </div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                {language === "en" ? "Review & Feedback" : "Review & Umpan Balik"}
              </h2>
            </div>
            <button
              onClick={onRevise}
              disabled={isGenerating || totalComments === 0}
              aria-label={language === "en" ? "Regenerate PRD" : "Buat Ulang PRD"}
              title={language === "en" ? "Regenerate PRD" : "Buat Ulang PRD"}
              className={`px-3 py-1.5 text-[12px] font-medium transition-all duration-150 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg cursor-pointer ${
                totalComments > 0
                  ? "bg-[var(--color-interactive)] text-white hover:bg-[var(--color-interactive-hover)]"
                  : "bg-transparent text-[var(--color-text-muted)] border border-[var(--color-border)]"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} strokeWidth={1.5} />
              <span>
                {language === "en" ? "Regenerate" : "Buat Ulang"}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {isFeedbackDrawerOpen && sections.map((section, index) => {
              const sectionId = `sec_${section.heading.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}_${index}`;
              const currentComment = comments[sectionId] || "";

              return (
                <FeedbackCard
                  key={sectionId}
                  section={section}
                  comment={currentComment}
                  onCommentChange={(text) => onCommentChange?.(sectionId, text)}
                  language={language}
                />
              );
            })}
          </div>
        </div>
      </div>

      {activeVersion && (
        <div className="mb-6">
          {/* Document Meta Toolbar */}
          <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-3 flex flex-wrap items-center justify-between gap-3 shadow-card">
            {/* Left metadata */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-primary)]">
                <GitBranch size={13} strokeWidth={1.5} className="text-[var(--color-interactive)]" />
                <span>Version {activeVersionIndex + 1}</span>
              </div>
              <time dateTime={new Date(activeVersion.timestamp).toISOString()} className="text-[12px] font-mono text-[var(--color-text-muted)]">
                {formatDate(activeVersion.timestamp, language)}
              </time>
              {content.length > 0 && (
                <span className="text-[12px] font-mono text-[var(--color-text-muted)] hidden sm:inline" title={language === "en" ? "Estimated output tokens" : "Estimasi token output"}>
                  · ~{formatTokenCount(estimateTokens(content))} {language === "en" ? "tokens" : "token"}
                </span>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {onCompareVersions && versions.length > 1 && (
                <button
                  type="button"
                  onClick={onCompareVersions}
                  className="bg-[var(--color-surface-elevated)] text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)]"
                  aria-label={language === "en" ? "Compare versions" : "Bandingkan versi"}
                  title={language === "en" ? "Compare versions" : "Bandingkan versi"}
                >
                  <GitCompare size={13} strokeWidth={1.5} />
                  <span>{language === "en" ? "Diff" : "Diff"}</span>
                </button>
              )}

              {onConvertMode && (
                <select
                  className="bg-[var(--color-surface-elevated)] text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--color-interactive)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  value={activeVersion?.prdMode || "business"}
                  onChange={(e) => onConvertMode(e.target.value as PRDMode)}
                  disabled={isGenerating}
                  aria-label={language === "en" ? "Convert PRD mode" : "Konversi mode PRD"}
                  title={language === "en" ? "Convert to another mode" : "Konversi ke mode lain"}
                >
                  <option value="business" className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]">{language === "en" ? "Business" : "Bisnis"}</option>
                  <option value="simple" className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]">{language === "en" ? "Simple" : "Sederhana"}</option>
                  <option value="technical" className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]">{language === "en" ? "Technical" : "Teknis"}</option>
                </select>
              )}

              <select
                className="bg-[var(--color-surface-elevated)] text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--color-interactive)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] cursor-pointer"
                value={activeVersionId || ""}
                onChange={(e) => onSwitchVersion?.(e.target.value)}
                aria-label={language === "en" ? "Select version" : "Pilih versi"}
              >
                {versions.map((v, i) => (
                  <option key={v.id} value={v.id} className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]">Version {i + 1}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Progress Bar */}
          {showProgress && totalSections > 0 && (
            <div className="flex items-center gap-3 px-1 mb-4">
              <div
                className="flex-1 h-[3px] bg-[var(--color-border)] rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={isGenerating ? (language === "en" ? "Generating PRD..." : "Membuat PRD...") : (language === "en" ? "PRD Complete" : "PRD Selesai")}
              >
                <div className={`h-full bg-[var(--color-interactive)] rounded-full transition-all duration-300 ${isGenerating ? 'animate-pulse' : ''}`} style={{width: `${progress}%`}} />
              </div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                {isComplete ? (language === "en" ? "100% Complete" : "100% Selesai") : `${progress}%`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {!content && isGenerating ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-3.5" data-prd-content="true">
          {sections.map((section, index) => {
            const sectionId = `sec_${section.heading.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}_${index}`;
            return (
              <LazySection
                key={sectionId}
                forceRender={!!isGenerating && index === sections.length - 1}
                heading={section.heading}
                index={index}
                total={sections.length}
              >
                <SheetSection
                  section={section}
                  sectionId={sectionId}
                  index={index}
                  total={sections.length}
                  isCollapsed={collapsedStates[sectionId] || false}
                  onToggleCollapse={handleToggleCollapse}
                  isGenerating={isGenerating}
                  language={language}
                  onOpenFeedback={handleOpenFeedback}
                />
              </LazySection>
            );
          })}
        </div>
      )}
    </div>
  );
});

const LazySection = memo(function LazySection({
  children,
  forceRender,
  heading,
  index,
  total,
}: {
  children: React.ReactNode;
  forceRender: boolean;
  heading: string;
  index: number;
  total: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(forceRender);

  useEffect(() => {
    if (forceRender) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [forceRender]);

  if (visible) {
    return <>{children}</>;
  }

  return (
    <div
      ref={ref}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden mb-3 print:hidden"
      style={{ minHeight: 100 }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] -rotate-90" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-[var(--color-text-primary)] text-[14px] font-semibold truncate">{heading}</h2>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{index + 1}/{total}</span>
      </div>
    </div>
  );
});

const SheetSection = memo(function SheetSection({
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {section.content}
              </ReactMarkdown>
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

function FeedbackCard({
  section,
  comment,
  onCommentChange,
  language,
}: {
  section: Section;
  comment: string;
  onCommentChange: (text: string) => void;
  language: "id" | "en";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempComment, setTempComment] = useState(comment);

  useEffect(() => {
    setTempComment(comment);
  }, [comment]);

  return (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-3.5 text-left transition-all hover:border-[var(--color-border-hover)]">
      <div className="font-medium text-[13px] text-[var(--color-text-primary)] mb-1.5 truncate" title={section.heading}>
        {section.heading}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2 mt-2">
          <textarea
            value={tempComment}
            onChange={(e) => setTempComment(e.target.value)}
            placeholder={language === "en" ? "Enter feedback or revision notes..." : "Tulis catatan revisi..."}
            className="w-full p-2.5 text-[12px] bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-interactive)] min-h-[70px] resize-y font-mono"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setTempComment(comment);
                setIsEditing(false);
              }}
              className="px-2.5 py-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-surface)] cursor-pointer"
            >
              {language === "en" ? "Cancel" : "Batal"}
            </button>
            <button
              onClick={() => {
                onCommentChange(tempComment);
                setIsEditing(false);
              }}
              className="px-3 py-1 text-[11px] bg-[var(--color-interactive)] text-white rounded-md hover:bg-[var(--color-interactive-hover)] cursor-pointer"
            >
              {language === "en" ? "Save" : "Simpan"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {comment ? (
            <div className="text-[12px] text-[var(--color-text-secondary)] bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-border)] font-mono whitespace-pre-wrap">
              {comment}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--color-text-muted)] italic">
              {language === "en" ? "No feedback for this section." : "Belum ada catatan."}
            </p>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="mt-2 text-[11px] text-[var(--color-interactive)] hover:underline cursor-pointer"
          >
            {comment ? (language === "en" ? "Edit feedback" : "Ubah catatan") : (language === "en" ? "+ Add feedback" : "+ Tambah catatan")}
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)]" />
      <div className="h-40 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]" />
      <div className="h-40 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]" />
    </div>
  );
}
