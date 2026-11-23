import { memo } from "react";
import { Plus, MessageSquareText, Clock, PanelLeftClose, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { PRDVersion } from "../types";
import { formatDate } from "../utils/format";
import { MAX_PERSISTED_VERSIONS } from "../utils/persistence";
import type { OutlineItem } from "../utils/outline";
import { POPOVER_FADE, SPRING_SLIDE } from "../utils/motion";
import { useT } from "../hooks/useT";
import { BrandMark } from "./BrandMark";

export interface SidebarProps {
  versions: PRDVersion[];
  activeVersionId: string | null;
  onSwitchVersion: (id: string) => void;
  onNewPRD: () => void;
  language: "id" | "en";
  isOpen: boolean;
  onClose: () => void;
  outlineItems?: OutlineItem[];
  activeSectionId?: string;
  onSelectSection?: (id: string) => void;
  onQuickNoteSection?: (id: string) => void;
  providerLabel: string;
  modelName: string;
  isGenerating: boolean;
  onOpenSettings: () => void;
  maxVersions?: number;
}

function getModeDotClass(version: PRDVersion): string {
  if (version.customChapterIds && version.customChapterIds.length > 0) {
    return "bg-[var(--oa-accent-champagne)]";
  }
  switch (version.prdMode) {
    case "technical":
      return "bg-[var(--oa-signal-steel)]";
    case "simple":
      return "bg-[var(--oa-signal-sage)]";
    case "business":
    default:
      return "bg-[var(--oa-signal-ochre)]";
  }
}

export const Sidebar = memo(function Sidebar({
  versions,
  activeVersionId,
  onSwitchVersion,
  onNewPRD,
  language,
  isOpen,
  onClose,
  outlineItems,
  activeSectionId,
  onSelectSection,
  onQuickNoteSection,
  providerLabel,
  modelName,
  isGenerating,
  onOpenSettings,
  maxVersions = MAX_PERSISTED_VERSIONS,
}: SidebarProps) {
  const t = useT(language);
  const storagePercent = Math.min(
    100,
    Math.round((versions.length / Math.max(1, maxVersions)) * 100),
  );
  const stagedNotesCount = outlineItems
    ? outlineItems.filter((item) => item.hasComment).length
    : 0;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={POPOVER_FADE}
            className="fixed inset-0 bg-[var(--oa-scrim)] backdrop-blur-xs z-[55] lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        role="region"
        aria-label={language === "en" ? "Sidebar navigation" : "Navigasi sidebar"}
        aria-hidden={!isOpen}
        initial={false}
        animate={{
          width: isOpen ? 256 : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={SPRING_SLIDE}
        className={`h-full bg-[var(--oa-bg-rail)] overflow-hidden shrink-0 flex flex-col no-print fixed inset-y-0 left-0 lg:relative lg:inset-auto z-[60] lg:z-auto ${
          isOpen
            ? "border-r border-[var(--oa-border-default)] pointer-events-auto"
            : "border-r-0 pointer-events-none"
        }`}
      >
        <div
          className="w-[256px] h-full flex flex-col shrink-0"
          inert={!isOpen ? true : undefined}
        >
          {/* Top header */}
          <div className="h-[52px] shrink-0 px-3.5 flex items-center justify-between border-b border-[var(--oa-border-subtle)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandMark size={28} />
              <span className="text-[13.5px] font-semibold tracking-[-0.02em] text-[var(--oa-text-primary)] truncate">
                {t.welcome.title}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.sidebar.collapse}
              title={t.sidebar.collapse}
              className="p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              <PanelLeftClose size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          {/* Sculpted + New PRD button */}
          <div className="p-3 shrink-0">
            <button
              type="button"
              onClick={onNewPRD}
              className="w-full oa-elev-sheet hover:bg-[var(--oa-bg-hover)]/70 hover:border-[var(--oa-border-strong)] rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[13px] font-medium text-[var(--oa-text-primary)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Plus
                  size={15}
                  strokeWidth={2}
                  className="text-[var(--oa-accent-champagne)] shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">{t.sidebar.newPrd}</span>
              </span>
              <kbd className="shrink-0 px-1.5 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[10px] font-mono text-[var(--oa-text-muted)]">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Scrollable middle: Chapter Outline & Recent Workspaces */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-4">
            {outlineItems && outlineItems.length > 0 && (
              <section aria-label={isGenerating ? t.outline.liveTitle : t.outline.chapterTitle}>
                <div className="px-2 pt-1 pb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] truncate">
                    {isGenerating ? t.outline.liveTitle : t.outline.chapterTitle}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isGenerating && stagedNotesCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-mono leading-none bg-[var(--oa-accent-champagne-tint)] text-[var(--oa-text-champagne)] border border-[var(--oa-border-champagne)]">
                        {t.outline.noteCount.replace("{count}", String(stagedNotesCount))}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[var(--oa-text-muted)]">
                      {String(outlineItems.length).padStart(2, "0")}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  {outlineItems.map((item) => {
                    const isSelected = activeSectionId === item.id;
                    const quickNoteLabel = t.sheet.quickNoteLabel.replace(
                      "{num}",
                      item.indexLabel,
                    );
                    return (
                      <div
                        key={item.id}
                        className={`group w-full flex items-center gap-1 rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-[var(--oa-bg-elevated)] border-[var(--oa-border-champagne)] text-[var(--oa-text-primary)]"
                            : "bg-transparent border-transparent text-[var(--oa-text-secondary)] hover:bg-[var(--oa-bg-hover)]/50 hover:text-[var(--oa-text-primary)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectSection?.(item.id)}
                          className="flex-1 min-w-0 flex items-center gap-2 pl-2.5 py-1.5 pr-1 text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none rounded-lg"
                        >
                          <span className="text-[10.5px] font-mono text-[var(--oa-text-muted)] shrink-0">
                            {item.indexLabel}
                          </span>
                          <span className="text-[12px] truncate flex-1">
                            {item.title}
                          </span>
                        </button>
                        <span className="shrink-0 pr-1.5 flex items-center">
                          {item.status === "done" && (
                            <Check
                              size={12}
                              strokeWidth={2}
                              className="text-[var(--oa-signal-sage)]"
                              aria-hidden="true"
                            />
                          )}
                          {item.status === "streaming" && (
                            <span
                              className="w-2 h-2 rounded-full bg-[var(--oa-accent-champagne)] animate-pulse inline-block"
                              aria-label={t.outline.streaming}
                            />
                          )}
                          {item.status === "idle" &&
                            (item.hasComment ? (
                              onQuickNoteSection && !isGenerating ? (
                                <button
                                  type="button"
                                  onClick={() => onQuickNoteSection(item.id)}
                                  aria-label={quickNoteLabel}
                                  title={t.sheet.editNote}
                                  className="px-1.5 rounded-full text-[10px] font-mono leading-4 bg-[var(--oa-accent-champagne-tint)] text-[var(--oa-text-champagne)] border border-[var(--oa-border-champagne)] hover:bg-[var(--oa-accent-champagne)]/20 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                                >
                                  1
                                </button>
                              ) : (
                                <span
                                  className="px-1.5 rounded-full text-[10px] font-mono leading-4 bg-[var(--oa-accent-champagne-tint)] text-[var(--oa-text-champagne)] border border-[var(--oa-border-champagne)]"
                                  aria-label={t.outline.noteCount.replace("{count}", "1")}
                                >
                                  1
                                </span>
                              )
                            ) : onQuickNoteSection && !isGenerating ? (
                              <button
                                type="button"
                                onClick={() => onQuickNoteSection(item.id)}
                                aria-label={quickNoteLabel}
                                title={t.sheet.addNote}
                                className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[var(--oa-text-muted)] hover:text-[var(--oa-text-champagne)] hover:bg-[var(--oa-accent-champagne-tint)] border border-transparent hover:border-[var(--oa-border-champagne)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                              >
                                <Plus size={11} strokeWidth={2} aria-hidden="true" />
                              </button>
                            ) : null)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section aria-label={t.sidebar.recentWorkspaces}>
              <div className="px-2 pt-1 pb-1.5 flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
                <Clock size={11} strokeWidth={1.5} aria-hidden="true" />
                <span>{t.sidebar.recentWorkspaces}</span>
              </div>

              {versions.length === 0 ? (
                <div className="mx-1 px-3 py-5 text-center rounded-xl border border-dashed border-[var(--oa-border-subtle)]">
                  <MessageSquareText
                    size={18}
                    strokeWidth={1.5}
                    className="text-[var(--oa-text-muted)] mx-auto mb-1.5 opacity-60"
                    aria-hidden="true"
                  />
                  <p className="text-[11.5px] text-[var(--oa-text-muted)]">
                    {t.sidebar.noWorkspaces}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {[...versions].reverse().map((v, i) => {
                    const isActive = v.id === activeVersionId;
                    const rawTitle = v.userDisplayPrompt || v.prompt;
                    const promptTitle = rawTitle
                      ? rawTitle.length > 50
                        ? `${rawTitle.slice(0, 50)}...`
                        : rawTitle
                      : v.productType !== "Unknown"
                        ? v.productType
                        : language === "en"
                          ? "Draft Spec"
                          : "Draf Spesifikasi";
                    const modeLabel =
                      v.customChapterIds && v.customChapterIds.length > 0
                        ? "CUSTOM"
                        : v.prdMode
                          ? v.prdMode.toUpperCase()
                          : "PRD";

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onSwitchVersion(v.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                          isActive
                            ? "bg-[var(--oa-bg-elevated)] border-[var(--oa-border-champagne)]"
                            : "bg-transparent border-transparent hover:bg-[var(--oa-bg-hover)]/45 hover:border-[var(--oa-border-subtle)] text-[var(--oa-text-secondary)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getModeDotClass(v)}`}
                              aria-hidden="true"
                            />
                            <span className="text-[12px] font-semibold text-[var(--oa-text-primary)] truncate">
                              {language === "en"
                                ? `Version ${versions.length - i}`
                                : `Versi ${versions.length - i}`}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-[var(--oa-text-muted)] shrink-0">
                            {modeLabel}
                          </span>
                        </div>
                        <div className="text-[12px] text-[var(--oa-text-secondary)] line-clamp-1 mb-1.5 leading-snug">
                          {promptTitle}
                        </div>
                        <time
                          dateTime={new Date(v.timestamp).toISOString()}
                          className="text-[10.5px] text-[var(--oa-text-muted)] font-mono block"
                        >
                          {formatDate(v.timestamp, language)}
                        </time>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Bottom pinned telemetry area */}
          <div className="shrink-0 p-3 border-t border-[var(--oa-border-subtle)] space-y-2.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full oa-recessed-well rounded-xl p-2.5 text-left hover:border-[var(--oa-border-default)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
                  {t.sidebar.activeModel}
                </span>
                <span className="text-[10.5px] font-medium text-[var(--oa-text-secondary)] truncate">
                  {providerLabel}
                </span>
              </div>
              <div className="text-[12px] font-mono text-[var(--oa-text-primary)] truncate mb-1.5">
                {modelName}
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--oa-text-muted)]">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isGenerating
                      ? "bg-[var(--oa-accent-champagne)] animate-pulse"
                      : "bg-[var(--oa-signal-sage)]"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {isGenerating ? t.sidebar.streaming : `httpOnly · ${t.sidebar.ready}`}
                </span>
              </div>
            </button>

            <div className="px-0.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] text-[var(--oa-text-muted)]">
                <span>{t.sidebar.storageSync}</span>
                <span className="font-mono text-[var(--oa-text-secondary)]">
                  {versions.length} / {maxVersions}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--oa-accent-champagne)] transition-[width] duration-300"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
});
