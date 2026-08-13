import { motion } from "motion/react";
import { getQuickPrompts } from "../utils/quickPrompts";
import { PRDMode } from "../types";
import { Briefcase, Code, Zap } from "lucide-react";
import { useT } from "../hooks/useT";

interface WelcomeScreenProps {
  language: "en" | "id";
  onQuickPrompt: (text: string) => void;
  prdMode: PRDMode;
  onChangeMode: (mode: PRDMode) => void;
}

export function WelcomeScreen({ language, onQuickPrompt, prdMode, onChangeMode }: WelcomeScreenProps) {
  const t = useT(language);
  return (
    <div className="w-full flex flex-col items-center justify-center flex-1 h-full pt-[5vh] sm:pt-[10vh]">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center w-full max-w-[640px]"
      >
        <h1 className="text-[36px] sm:text-[48px] font-[700] text-[var(--color-text-primary)] mb-2 tracking-tight">
          {t.welcome.title}
        </h1>
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          {t.welcome.tagline}
        </p>
        <div className="w-12 h-[2px] bg-[var(--color-border)] mx-auto my-6"></div>

        <div
          role="radiogroup"
          aria-label={t.welcome.modeGroupLabel}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left w-full px-4 sm:px-0 mx-auto"
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
          <button 
            type="button"
            role="radio"
            aria-checked={prdMode === "business"}
            onClick={() => onChangeMode("business")}
            className={`p-5 rounded-lg border flex flex-col gap-2 min-h-[120px] justify-center transition-[color,border-color,opacity,shadow,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97] ${
              prdMode === "business" 
                ? "bg-[var(--color-mode-business-bg)]/40 border-[var(--color-mode-business)] shadow-[0_0_15px_rgba(68,102,255,0.15)]" 
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] opacity-80"
            }`}
          >
            <span className={`text-[15px] font-semibold flex items-center justify-center gap-2 ${prdMode === "business" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
              <Briefcase className="w-5 h-5" />
              {t.welcome.businessMode}
            </span>
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              {t.welcome.businessDesc}
            </span>
          </button>

          <button 
            type="button"
            role="radio"
            aria-checked={prdMode === "simple"}
            onClick={() => onChangeMode("simple")}
            className={`p-5 rounded-lg border flex flex-col gap-2 min-h-[120px] justify-center transition-[color,border-color,opacity,shadow,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97] ${
              prdMode === "simple" 
                ? "bg-[var(--color-mode-simple-bg)]/40 border-[var(--color-mode-simple)] shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] opacity-80"
            }`}
          >
            <span className={`text-[15px] font-semibold flex items-center justify-center gap-2 ${prdMode === "simple" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
              <Zap className="w-5 h-5" />
              {t.welcome.simpleMode}
            </span>
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              {t.welcome.simpleDesc}
            </span>
          </button>

          <button 
            type="button"
            role="radio"
            aria-checked={prdMode === "technical"}
            onClick={() => onChangeMode("technical")}
            className={`p-5 rounded-lg border flex flex-col gap-2 min-h-[120px] justify-center transition-[color,border-color,opacity,shadow,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97] ${
              prdMode === "technical" 
                ? "bg-[var(--color-mode-technical-bg)]/40 border-[var(--color-mode-technical)] shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] opacity-80"
            }`}
          >
            <span className={`text-[15px] font-semibold flex items-center justify-center gap-2 ${prdMode === "technical" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
              <Code className="w-5 h-5" />
              {t.welcome.technicalMode}
            </span>
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              {t.welcome.technicalDesc}
            </span>
          </button>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } }
        }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-[640px] px-4 sm:px-0 mt-2"
      >
        {getQuickPrompts(language, prdMode).map((qp) => {
          const Icon = qp.icon;
          return (
            <motion.button
              key={qp.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
              }}
              type="button"
              onClick={() => onQuickPrompt(qp.text)}
              className="group flex flex-col items-center justify-center text-center p-3 sm:p-4 min-h-[44px] border border-[var(--color-border)] rounded-sm bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-[color,border-color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
            >
              <Icon size={16} strokeWidth={1.5} className="mb-2 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]" />
              <span className="text-[13px] leading-[1.3]">{qp.label}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
