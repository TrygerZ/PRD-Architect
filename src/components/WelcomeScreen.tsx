import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { PRDMode } from "../types";
import { getQuickPrompts } from "../utils/quickPrompts";
import { EXPO_MORPH } from "../utils/motion";
import { useT } from "../hooks/useT";
import { BrandMark } from "./BrandMark";
import { CustomPrdBuilder } from "./CustomPrdBuilder";

export interface WelcomeScreenProps {
  language: "en" | "id";
  onQuickPrompt: (text: string) => void;
  prdMode: PRDMode;
  onChangeMode: (mode: PRDMode) => void;
  builderTab: "standard" | "custom";
  onChangeBuilderTab: (tab: "standard" | "custom") => void;
  selectedIds: string[];
  onChangeSelectedIds: (ids: string[]) => void;
  composer: ReactNode;
}

export function WelcomeScreen({
  language,
  onQuickPrompt,
  prdMode,
  builderTab,
  selectedIds,
  onChangeSelectedIds,
  composer,
}: WelcomeScreenProps) {
  const t = useT(language);
  const isCustom = builderTab === "custom";
  const quickPrompts = getQuickPrompts(language, prdMode).slice(0, 3);

  return (
    <motion.div
      layout
      transition={EXPO_MORPH}
      className={`w-full mx-auto flex flex-col items-center flex-1 min-h-full px-4 sm:px-6 ${
        isCustom
          ? "justify-start pt-4 sm:pt-6 pb-8 max-w-[1000px]"
          : "justify-center py-8 max-w-[820px]"
      }`}
    >
      {isCustom ? (
        <div className="flex items-center justify-center gap-2.5 mb-4 text-center">
          <BrandMark size={28} />
          <h1 className="text-[18px] sm:text-[20px] font-medium tracking-[-0.025em] text-[var(--oa-text-primary)]">
            {t.welcome.greeting}
          </h1>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center mb-6">
          <BrandMark size={36} />
          <h1 className="text-[26px] sm:text-[30px] font-medium tracking-[-0.03em] text-[var(--oa-text-primary)] mt-4 leading-tight">
            {t.welcome.greeting}
          </h1>
          <p className="text-[13.5px] sm:text-[14px] text-[var(--oa-text-secondary)] max-w-[520px] mt-2 leading-relaxed">
            {t.welcome.subtitle}
          </p>
        </div>
      )}

      {/* Adaptive Omni-Composer slot */}
      <div className="w-full">{composer}</div>

      <AnimatePresence mode="wait">
        {isCustom ? (
          <motion.div
            key="custom-builder"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={EXPO_MORPH}
            className="w-full max-w-[960px] mx-auto mt-5"
          >
            <CustomPrdBuilder
              language={language}
              selectedIds={selectedIds}
              onChangeSelectedIds={onChangeSelectedIds}
            />
          </motion.div>
        ) : (
          <motion.div
            key="quick-starters"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={EXPO_MORPH}
            className="w-full max-w-[780px] mx-auto mt-6"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
                {t.welcome.quickStarters}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {quickPrompts.map((qp) => {
                const Icon = qp.icon;
                return (
                  <button
                    key={qp.id}
                    type="button"
                    onClick={() => onQuickPrompt(qp.text)}
                    className="group oa-elev-sheet rounded-xl p-3 text-left hover:border-[var(--oa-border-champagne)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon
                          size={14}
                          strokeWidth={1.5}
                          className="text-[var(--oa-text-muted)] group-hover:text-[var(--oa-accent-champagne)] shrink-0 transition-colors"
                          aria-hidden="true"
                        />
                        <span className="text-[12.5px] font-medium text-[var(--oa-text-primary)] truncate">
                          {qp.label}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={12}
                        strokeWidth={1.5}
                        className="text-[var(--oa-text-muted)] group-hover:text-[var(--oa-text-primary)] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-[11.5px] text-[var(--oa-text-secondary)] line-clamp-2 leading-snug">
                      {qp.text}
                    </p>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] font-mono text-[var(--oa-text-muted)] text-center mt-5">
              {t.composer.keyboardHint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
