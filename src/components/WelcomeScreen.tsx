import { motion } from "motion/react";
import { getQuickPrompts } from "../utils/quickPrompts";
import { PRDMode } from "../types";
import { Briefcase, Code, Zap, ArrowUpRight } from "lucide-react";
import { useT } from "../hooks/useT";

interface WelcomeScreenProps {
  language: "en" | "id";
  onQuickPrompt: (text: string) => void;
  prdMode: PRDMode;
  onChangeMode: (mode: PRDMode) => void;
}

export function WelcomeScreen({ language, onQuickPrompt, prdMode, onChangeMode }: WelcomeScreenProps) {
  const t = useT(language);
  const quickPrompts = getQuickPrompts(language, prdMode);

  return (
    <div className="w-full flex flex-col items-center justify-center flex-1 h-full py-6 sm:py-10 max-w-[720px] mx-auto px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="text-center w-full"
      >
        {/* Subtle Category Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[11px] font-mono mb-4 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-interactive)]"></span>
          <span>{language === "en" ? "Structured PRD Workbench" : "Workbench Spesifikasi PRD"}</span>
        </div>

        <h1 className="text-[28px] sm:text-[36px] font-[600] text-[var(--color-text-primary)] mb-2 tracking-[-0.03em] leading-tight">
          {t.welcome.title}
        </h1>
        <p className="text-[13.5px] sm:text-[14px] text-[var(--color-text-secondary)] max-w-[480px] mx-auto leading-relaxed">
          {t.welcome.tagline}
        </p>

        {/* Bento Mode Selection */}
        <div
          role="radiogroup"
          aria-label={t.welcome.modeGroupLabel}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-6 text-center w-full"
          onKeyDown={(e) => {
            const modes: PRDMode[] = ["business", "simple", "technical"];
            const currIdx = modes.indexOf(prdMode);
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              onChangeMode(modes[(currIdx + 1) % modes.length]);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              onChangeMode(modes[(currIdx - 1 + modes.length) % modes.length]);
            }
          }}
        >
          {/* Business Mode */}
          <button
            type="button"
            role="radio"
            aria-checked={prdMode === "business"}
            onClick={() => onChangeMode("business")}
            className={`group relative p-4 rounded-xl border flex flex-col items-center text-center min-h-[132px] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer ${
              prdMode === "business"
                ? "bg-[var(--color-surface-elevated)] border-[var(--color-interactive)]/60 shadow-subtle ring-1 ring-[var(--color-interactive)]/40"
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-elevated)]/40"
            }`}
          >
            <span className="absolute top-2.5 right-2.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-highlight)]/50 px-1.5 py-0.5 rounded">
              12 ch
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-colors ${
              prdMode === "business"
                ? "bg-[var(--color-interactive)] text-[#080809] font-bold"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
            }`}>
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-1">
              {t.welcome.businessMode}
            </span>
            <span className="text-[11.5px] text-[var(--color-text-secondary)] leading-snug line-clamp-2 block max-w-[200px]">
              {t.welcome.businessDesc}
            </span>
          </button>

          {/* Simple Mode */}
          <button
            type="button"
            role="radio"
            aria-checked={prdMode === "simple"}
            onClick={() => onChangeMode("simple")}
            className={`group relative p-4 rounded-xl border flex flex-col items-center text-center min-h-[132px] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer ${
              prdMode === "simple"
                ? "bg-[var(--color-surface-elevated)] border-[var(--color-interactive)]/60 shadow-subtle ring-1 ring-[var(--color-interactive)]/40"
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-elevated)]/40"
            }`}
          >
            <span className="absolute top-2.5 right-2.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-highlight)]/50 px-1.5 py-0.5 rounded">
              6 ch
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-colors ${
              prdMode === "simple"
                ? "bg-[var(--color-interactive)] text-[#080809] font-bold"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
            }`}>
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-1">
              {t.welcome.simpleMode}
            </span>
            <span className="text-[11.5px] text-[var(--color-text-secondary)] leading-snug line-clamp-2 block max-w-[200px]">
              {t.welcome.simpleDesc}
            </span>
          </button>

          {/* Technical Mode */}
          <button
            type="button"
            role="radio"
            aria-checked={prdMode === "technical"}
            onClick={() => onChangeMode("technical")}
            className={`group relative p-4 rounded-xl border flex flex-col items-center text-center min-h-[132px] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer ${
              prdMode === "technical"
                ? "bg-[var(--color-surface-elevated)] border-[var(--color-interactive)]/60 shadow-subtle ring-1 ring-[var(--color-interactive)]/40"
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-elevated)]/40"
            }`}
          >
            <span className="absolute top-2.5 right-2.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-highlight)]/50 px-1.5 py-0.5 rounded">
              9 ch
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-colors ${
              prdMode === "technical"
                ? "bg-[var(--color-interactive)] text-[#080809] font-bold"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
            }`}>
              <Code className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-medium text-[var(--color-text-primary)] block mb-1">
              {t.welcome.technicalMode}
            </span>
            <span className="text-[11.5px] text-[var(--color-text-secondary)] leading-snug line-clamp-2 block max-w-[200px]">
              {t.welcome.technicalDesc}
            </span>
          </button>
        </div>
      </motion.div>

      {/* Starter Templates */}
      <div className="w-full mt-1">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            {language === "en" ? "Curated Blueprints" : "Cetak Biru Pilihan"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
          {quickPrompts.map((qp) => {
            const Icon = qp.icon;
            return (
              <button
                key={qp.id}
                type="button"
                onClick={() => onQuickPrompt(qp.text)}
                className="group flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-hover)] transition-all duration-150 text-left focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate mr-1">
                  <Icon size={14} strokeWidth={1.5} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-interactive)] shrink-0 transition-colors" />
                  <span className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">{qp.label}</span>
                </div>
                <ArrowUpRight size={12} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] shrink-0 transition-colors opacity-60 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
