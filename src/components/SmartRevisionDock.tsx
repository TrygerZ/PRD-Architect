import type { JSX } from "react";
import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SPRING_SLIDE } from "../utils/motion";
import { useT } from "../hooks/useT";

export interface SmartRevisionDockProps {
  comments: Record<string, string>;
  sections: Array<{ id: string; indexLabel: string }>;
  isGenerating: boolean;
  language: "id" | "en";
  onRevise: () => void;
  onClearAll: () => void;
  onJumpToSection: (id: string) => void;
}

export function SmartRevisionDock({
  comments,
  sections,
  isGenerating,
  language,
  onRevise,
  onClearAll,
  onJumpToSection,
}: SmartRevisionDockProps): JSX.Element {
  const t = useT(language);
  const staged = sections.filter((s) => Boolean(comments[s.id]?.trim()));

  return (
    <AnimatePresence>
      {staged.length > 0 && (
        <motion.div
          key="smart-revision-dock"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={SPRING_SLIDE}
          className="px-4 pb-2 shrink-0 z-30 no-print"
        >
          <div className="oa-elev-composer rounded-2xl max-w-[820px] mx-auto w-full px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full bg-[var(--oa-accent-champagne)] animate-pulse shrink-0"
                aria-hidden="true"
              />
              <span className="text-[12px] font-medium text-[var(--oa-text-primary)] shrink-0">
                {t.revisionDock.stagedLabel.replace(
                  "{count}",
                  String(staged.length),
                )}
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                {staged.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onJumpToSection(s.id)}
                    className="px-2 py-0.5 rounded-full bg-[var(--oa-accent-champagne-tint)] border border-[var(--oa-border-champagne)] text-[11px] font-mono text-[var(--oa-text-champagne)] hover:opacity-85 transition-opacity cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  >
                    {t.revisionDock.chapterPrefix} {s.indexLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                type="button"
                onClick={onClearAll}
                disabled={isGenerating}
                className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                {t.revisionDock.clearAll}
              </button>
              <button
                type="button"
                onClick={onRevise}
                disabled={isGenerating}
                className="oa-bevel-cta inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                <RefreshCw
                  size={12}
                  strokeWidth={2}
                  className={isGenerating ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                <span>{t.revisionDock.reviseCta}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
