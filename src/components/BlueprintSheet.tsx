import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  GitBranch,
  RefreshCw,
  ChevronDown,
  MessageSquareText,
  X,
  GitCompare,
} from "lucide-react";
import { PRDVersion, PRDMode } from "../types";
import { formatDate } from "../utils/format";
import { SheetSection } from "./BlueprintSection";
import { getSections, type Section } from "../utils/sections";
import { estimateTokens, formatTokenCount } from "../utils/tokens";

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
