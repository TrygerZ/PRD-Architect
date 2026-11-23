import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, ArrowRight, ChevronDown, GitCompare } from "lucide-react";
import { PRDVersion, PRDMode, ContinuationStatus, TruncationInfo } from "../types";
import { formatDate } from "../utils/format";
import { SheetSection } from "./BlueprintSection";
import { getSections } from "../utils/sections";
import { getSectionId } from "../utils/outline";
import { detectTrailingTruncation } from "../../shared/truncation";
import type { ThemeMode } from "../utils/theme";
import { estimateTokens, formatTokenCount } from "../utils/tokens";
import { parseBulletTree } from "../utils/wbs";
import {
  WBS_SECTION_RE,
  splitWbsSection,
  wbsRows,
  wbsTableRows,
  wbsTailNote,
} from "../utils/wbsTable";
import { useT } from "../hooks/useT";

export interface BlueprintSheetProps {
  content: string; // active version content
  comments?: Record<string, string>;
  onCommentChange?: (sectionId: string, comment: string) => void;
  versions?: PRDVersion[];
  activeVersionId?: string | null;
  onSwitchVersion?: (versionId: string) => void;
  onRevise?: () => void;
  isGenerating?: boolean;
  continuingStatus?: ContinuationStatus | null;
  truncatedInfo?: TruncationInfo | null;
  onContinue?: () => void;
  openNoteRequest?: { sectionId: string; nonce: number } | null;
  language: "id" | "en";
  onConvertMode?: (mode: PRDMode) => void;
  onCompareVersions?: () => void;
  theme?: ThemeMode;
}

const PRINT_REMARK_PLUGINS = [remarkGfm];

// Print view (#prd-print-only): section WBS dirender sebagai tabel HTML pola
// sama dengan live view — deteksi via splitWbsSection + WBS_SECTION_RE.
// CSS print di printTemplate.ts sudah styling table/th/td, jadi tabel polos
// tanpa class. Fallback aman: tanpa bullet → markdown biasa (konten tak hilang).
const PrintOnlyContent = memo(function PrintOnlyContent({ content, language }: { content: string; language: "id" | "en" }) {
  const sections = useMemo(() => getSections(content), [content]);
  const headers = language === "en" ? ["Module", "Feature", "Sub-feature"] : ["Modul", "Fitur", "Sub-fitur"];
  return (
    <>
      {sections.map((section, idx) => {
        const key = `print-${idx}`;
        const wbs = splitWbsSection(section.content);
        if (!(WBS_SECTION_RE.test(section.heading) || wbs !== null)) {
          return (
            <ReactMarkdown key={key} remarkPlugins={PRINT_REMARK_PLUGINS}>
              {section.heading + "\n\n" + section.content}
            </ReactMarkdown>
          );
        }
        const heading = wbs ? wbs.heading : section.heading;
        const after = wbs ? wbs.after : section.content;
        const items = parseBulletTree(after);
        const rows = wbsTableRows(wbsRows(items));
        const tailNote = wbsTailNote(after);
        return (
          <div key={key}>
            {wbs && wbs.before.trim() ? <ReactMarkdown remarkPlugins={PRINT_REMARK_PLUGINS}>{wbs.before}</ReactMarkdown> : null}
            <ReactMarkdown remarkPlugins={PRINT_REMARK_PLUGINS}>{heading}</ReactMarkdown>
            {items.length === 0 ? (
              <ReactMarkdown remarkPlugins={PRINT_REMARK_PLUGINS}>{after}</ReactMarkdown>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        {r.module !== null && <td rowSpan={r.moduleSpan ?? 1}>{r.module}</td>}
                        {r.feature !== null && <td rowSpan={r.featureSpan ?? 1}>{r.feature}</td>}
                        <td>{r.sub}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tailNote ? <ReactMarkdown remarkPlugins={PRINT_REMARK_PLUGINS}>{tailNote}</ReactMarkdown> : null}
              </>
            )}
          </div>
        );
      })}
    </>
  );
});

export const BlueprintSheet = memo(function BlueprintSheet({
  content,
  comments = {},
  onCommentChange,
  versions = [],
  activeVersionId,
  onSwitchVersion,
  onRevise: _onRevise,
  isGenerating,
  continuingStatus,
  truncatedInfo,
  onContinue,
  openNoteRequest,
  language,
  onConvertMode: _onConvertMode,
  onCompareVersions,
  theme = "dark",
}: BlueprintSheetProps) {
  const t = useT(language);
  const sections = useMemo(() => getSections(content), [content]);
  const [collapsedStates, setCollapsedStates] = useState<Record<string, boolean>>({});

  const activeVersion =
    versions.find((v) => v.id === activeVersionId) || versions[versions.length - 1];
  const activeVersionIndex = activeVersion
    ? versions.findIndex((v) => v.id === activeVersion.id)
    : 0;

  const totalSections = sections.length;
  const isComplete = content.length > 0 && !isGenerating;
  const showProgress = content.length > 0;
  const customLen = activeVersion?.customChapterIds?.length ?? 0;
  const expectedSections =
    customLen > 0
      ? customLen
      : ({ simple: 6, business: 12, technical: 9 }[activeVersion?.prdMode ?? "business"] ?? 12);
  const progress = isComplete
    ? 100
    : isGenerating && content.length > 0
      ? Math.min(95, Math.max(5, Math.round((totalSections / expectedSections) * 100)))
      : 0;

  const handleToggleCollapse = useCallback((sectionId: string) => {
    setCollapsedStates((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const modeBadge = (() => {
    if (customLen > 0) {
      return {
        dotClass: "bg-[var(--oa-accent-champagne)]",
        label: t.builder.tabCustom,
      };
    }
    switch (activeVersion?.prdMode) {
      case "technical":
        return {
          dotClass: "bg-[var(--oa-signal-steel)]",
          label: t.welcome.technicalMode,
        };
      case "simple":
        return {
          dotClass: "bg-[var(--oa-signal-sage)]",
          label: t.welcome.simpleMode,
        };
      case "business":
      default:
        return {
          dotClass: "bg-[var(--oa-signal-ochre)]",
          label: t.welcome.businessMode,
        };
    }
  })();

  const streamingChapterLabel = String(Math.max(1, totalSections)).padStart(2, "0");
  const streamingStatusText = continuingStatus
    ? `${t.sheet.continuingBadge
        .replace("{attempt}", String(continuingStatus.attempt))
        .replace("{max}", String(continuingStatus.maxAttempts))
        .toUpperCase()} / ${t.revisionDock.chapterPrefix.toUpperCase()} ${streamingChapterLabel}`
    : `${t.outline.streaming.toUpperCase()} ${t.revisionDock.chapterPrefix.toUpperCase()} ${streamingChapterLabel}`;

  const trailingCut = useMemo(
    () => (!isGenerating && content.length > 0 ? detectTrailingTruncation(content) : null),
    [isGenerating, content],
  );

  const effectiveTruncation: TruncationInfo | null = !isGenerating && content.length > 0
    ? truncatedInfo ??
      (trailingCut
        ? {
            reason: "length",
            detectedChapters: totalSections,
            expectedChapters: expectedSections,
          }
        : totalSections > 0 && totalSections < expectedSections
          ? {
              reason: "missing_chapters",
              detectedChapters: totalSections,
              expectedChapters: expectedSections,
            }
          : null)
    : null;

  return (
    <div className="w-full mx-auto relative print:block print:w-full print:max-w-full print:bg-white print:text-black">
      {/* Hidden container for full PRD print export — skipped while streaming to avoid double markdown parsing */}
      <div id="prd-print-only" style={{ display: "none" }}>
        {!isGenerating && <PrintOnlyContent content={content} language={language} />}
      </div>

      {activeVersion && (
        <div className="mb-5 space-y-3">
          {/* Document Meta Header */}
          <div className="oa-elev-sheet rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[11px] font-mono font-medium text-[var(--oa-text-primary)]">
                v{activeVersionIndex + 1}
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[11.5px] font-medium text-[var(--oa-text-secondary)]">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${modeBadge.dotClass}`}
                  aria-hidden="true"
                />
                <span className="truncate">{modeBadge.label}</span>
              </span>

              <time
                dateTime={new Date(activeVersion.timestamp).toISOString()}
                className="text-[11.5px] font-mono text-[var(--oa-text-muted)]"
              >
                {formatDate(activeVersion.timestamp, language)}
              </time>

              {content.length > 0 && (
                <span
                  className="text-[11.5px] font-mono text-[var(--oa-text-muted)] hidden sm:inline"
                  title={
                    language === "en"
                      ? "Estimated output tokens"
                      : "Estimasi token output"
                  }
                >
                  ~{formatTokenCount(estimateTokens(content))} {t.composer.tokensSuffix}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isGenerating && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--oa-accent-champagne-tint)] border border-[var(--oa-border-champagne)] text-[10.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-champagne)]">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--oa-accent-champagne)] animate-pulse shrink-0"
                    aria-hidden="true"
                  />
                  <span>{streamingStatusText}</span>
                </span>
              )}

              {onCompareVersions && versions.length > 1 && (
                <button
                  type="button"
                  onClick={onCompareVersions}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-default)] hover:border-[var(--oa-border-strong)] text-[11.5px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  aria-label={language === "en" ? "Compare versions" : "Bandingkan versi"}
                >
                  <GitCompare size={12} strokeWidth={1.6} aria-hidden="true" />
                  <span>{t.header.diff}</span>
                </button>
              )}

              {versions.length > 1 && (
                <select
                  className="bg-[var(--oa-bg-recessed)] text-[11.5px] font-mono text-[var(--oa-text-secondary)] border border-[var(--oa-border-default)] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[var(--oa-border-champagne)] focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] cursor-pointer"
                  value={activeVersionId || ""}
                  onChange={(e) => onSwitchVersion?.(e.target.value)}
                  aria-label={language === "en" ? "Select version" : "Pilih versi"}
                >
                  {versions.map((v, i) => (
                    <option
                      key={v.id}
                      value={v.id}
                      className="bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)]"
                    >
                      v{i + 1}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Thin Satin Champagne Streaming Progress Bar */}
          {showProgress && totalSections > 0 && isGenerating && (
            <div className="flex items-center gap-3 px-1">
              <div
                className="flex-1 h-[2px] bg-[var(--oa-bg-recessed)] rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t.composer.generating}
              >
                <div
                  className="h-full bg-[var(--oa-accent-champagne)] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10.5px] font-mono text-[var(--oa-text-champagne)] whitespace-nowrap">
                {progress}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {!content && isGenerating ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-4" data-prd-content="true">
          {sections.map((section, index) => {
            const sectionId = getSectionId(section.heading, index);
            return (
              <div
                key={sectionId}
                id={`prd-section-${sectionId}`}
                className="scroll-mt-4"
              >
                <LazySection
                  forceRender={Boolean(
                    (isGenerating && index === sections.length - 1) ||
                      openNoteRequest?.sectionId === sectionId,
                  )}
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
                    theme={theme}
                    comment={comments[sectionId] || ""}
                    onCommentChange={onCommentChange}
                    openNoteNonce={
                      openNoteRequest?.sectionId === sectionId ? openNoteRequest.nonce : 0
                    }
                    isStreamingSection={Boolean(
                      isGenerating && index === sections.length - 1,
                    )}
                  />
                </LazySection>
              </div>
            );
          })}

          {effectiveTruncation && onContinue && (
            <div
              role="status"
              className="oa-elev-sheet rounded-2xl p-4 sm:p-5 border border-[var(--oa-signal-ochre)]/45 bg-[var(--oa-signal-ochre-tint)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-signal-ochre)]/40 flex items-center justify-center text-[var(--oa-signal-ochre)] shrink-0 mt-0.5">
                  <AlertTriangle size={15} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-[var(--oa-text-primary)] leading-snug">
                    {t.sheet.incompleteTitle
                      .replace("{detected}", String(effectiveTruncation.detectedChapters))
                      .replace("{expected}", String(effectiveTruncation.expectedChapters))}
                  </p>
                  <p className="mt-1 text-[12.5px] text-[var(--oa-text-secondary)] leading-relaxed">
                    {effectiveTruncation.reason === "length"
                      ? t.sheet.incompleteLengthDesc
                      : t.sheet.incompleteChaptersDesc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onContinue}
                className="oa-bevel-cta inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-semibold cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--oa-bg-canvas)] focus-visible:outline-none"
              >
                <span>{t.sheet.continueCta}</span>
                <ArrowRight size={14} strokeWidth={1.85} aria-hidden="true" />
              </button>
            </div>
          )}
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
      className="oa-elev-sheet rounded-2xl overflow-hidden print:hidden"
      style={{ minHeight: 100 }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--oa-border-subtle)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown
            className="w-4 h-4 text-[var(--oa-text-muted)] -rotate-90 shrink-0"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[10.5px] font-mono text-[var(--oa-text-champagne)] shrink-0">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="text-[var(--oa-text-primary)] text-[14px] font-semibold truncate">
            {heading}
          </h2>
        </div>
        <span className="text-[11px] font-mono text-[var(--oa-text-muted)] px-2 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] shrink-0">
          {index + 1}/{total}
        </span>
      </div>
    </div>
  );
});

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 oa-elev-sheet rounded-2xl" />
      <div className="h-44 oa-elev-sheet rounded-2xl" />
      <div className="h-44 oa-elev-sheet rounded-2xl" />
    </div>
  );
}
