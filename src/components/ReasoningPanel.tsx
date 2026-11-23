import { memo, useEffect, useRef, useState } from "react";
import { Terminal, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { EXPO_MORPH } from "../utils/motion";

export interface ReasoningPanelProps {
  reasoning?: string;
  isGenerating?: boolean;
  language: "id" | "en";
}

export const ReasoningPanel = memo(function ReasoningPanel({
  reasoning,
  isGenerating = false,
  language,
}: ReasoningPanelProps) {
  const [open, setOpen] = useState<boolean>(isGenerating);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const frozenForReasoningRef = useRef<string | undefined>(undefined);

  const hasReasoning = Boolean(reasoning?.trim());

  // Track elapsed thinking seconds while reasoning streams, freeze on completion, reset on new run
  useEffect(() => {
    if (isGenerating) {
      if (!hasReasoning) {
        startTimeRef.current = null;
        frozenForReasoningRef.current = undefined;
        setElapsedMs(0);
        return;
      }

      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
        setElapsedMs(0);
      }

      const intervalId = window.setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsedMs(Date.now() - startTimeRef.current);
        }
      }, 100);

      return () => {
        window.clearInterval(intervalId);
      };
    }

    if (startTimeRef.current !== null) {
      setElapsedMs(Date.now() - startTimeRef.current);
      startTimeRef.current = null;
      frozenForReasoningRef.current = reasoning;
    } else if (!hasReasoning || reasoning !== frozenForReasoningRef.current) {
      setElapsedMs(0);
      frozenForReasoningRef.current = undefined;
    }
  }, [isGenerating, hasReasoning, reasoning]);

  // Auto-expand during active generation, auto-collapse to pill once finished
  useEffect(() => {
    setOpen(isGenerating);
  }, [isGenerating]);

  if (!hasReasoning) return null;

  const secondsText = (elapsedMs / 1000).toFixed(1);
  const unit = language === "en" ? "s" : "d";
  const summaryLabel = isGenerating
    ? language === "en"
      ? "Thinking"
      : "Menalar"
    : elapsedMs > 0
      ? language === "en"
        ? `Thought for ${secondsText}s`
        : `Berpikir selama ${secondsText}d`
      : language === "en"
        ? "Reasoning trace"
        : "Jejak penalaran";

  const toggleLabel = language === "en" ? "Inspect trace" : "Lihat jejak";

  if (!isGenerating && !open) {
    return (
      <div className="mb-4 no-print">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="oa-recessed-well inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] text-[var(--oa-text-secondary)] hover:border-[var(--oa-border-default)] hover:text-[var(--oa-text-primary)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
        >
          <Terminal
            size={12}
            strokeWidth={1.6}
            className="text-[var(--oa-text-champagne)] shrink-0"
            aria-hidden="true"
          />
          <span className="font-mono font-medium text-[var(--oa-text-primary)]">
            {summaryLabel}
          </span>
          <span className="text-[11px] text-[var(--oa-text-muted)]">
            {toggleLabel}
          </span>
          <ChevronDown
            size={12}
            strokeWidth={1.6}
            className="-rotate-90 text-[var(--oa-text-muted)] transition-transform duration-150"
            aria-hidden="true"
          />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`oa-recessed-well rounded-xl mb-4 no-print overflow-hidden transition-colors ${
        isGenerating ? "border-[var(--oa-border-champagne)]" : ""
      }`}
    >
      {isGenerating && (
        <div
          className="relative h-[2px] w-full overflow-hidden bg-[var(--oa-border-subtle)]"
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-y-0 w-1/3 bg-[var(--oa-accent-champagne)]"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/35 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none cursor-pointer"
      >
        <Terminal
          size={13}
          strokeWidth={1.6}
          className={
            isGenerating
              ? "animate-pulse text-[var(--oa-accent-champagne)] shrink-0"
              : "text-[var(--oa-text-champagne)] shrink-0"
          }
          aria-hidden="true"
        />
        <span className="font-medium font-mono text-[var(--oa-text-primary)]">
          {summaryLabel}
        </span>

        <span className="ml-auto flex items-center gap-2 shrink-0">
          {isGenerating ? (
            <span className="px-2 py-0.5 rounded-md bg-[var(--oa-accent-champagne-tint)] border border-[var(--oa-border-champagne)] text-[10.5px] font-mono text-[var(--oa-text-champagne)]">
              {secondsText}
              {unit}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--oa-text-muted)]">
              {toggleLabel}
            </span>
          )}
          <ChevronDown
            size={13}
            strokeWidth={1.6}
            className={`text-[var(--oa-text-muted)] transition-transform duration-150 ${
              open ? "" : "-rotate-90"
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="reasoning-trace"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={EXPO_MORPH}
            className="overflow-hidden"
          >
            <pre className="px-4 py-3 text-[11.5px] leading-relaxed text-[var(--oa-text-secondary)] whitespace-pre-wrap break-words border-t border-[var(--oa-border-subtle)] max-h-[280px] overflow-y-auto font-mono">
              {reasoning}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
