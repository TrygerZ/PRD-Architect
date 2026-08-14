import { memo, useEffect, useState } from "react";
import { Terminal, ChevronDown } from "lucide-react";

interface ReasoningPanelProps {
  reasoning?: string;
  isGenerating?: boolean;
  language: "id" | "en";
}

export const ReasoningPanel = memo(function ReasoningPanel({
  reasoning,
  isGenerating,
  language,
}: ReasoningPanelProps) {
  const [open, setOpen] = useState(true);

  // Auto-collapse setelah streaming selesai agar tidak mengganggu pembacaan PRD
  useEffect(() => {
    if (!isGenerating) setOpen(false);
  }, [isGenerating]);

  if (!reasoning?.trim()) return null;

  return (
    <div className="border border-[var(--color-border)] rounded-xl mb-4 bg-[var(--color-surface)] shadow-xs no-print overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]/50 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
      >
        <Terminal
          size={13}
          strokeWidth={1.5}
          className={isGenerating ? "animate-pulse text-[var(--color-interactive)]" : "text-[var(--color-text-muted)]"}
        />
        <span className="font-medium font-mono">
          {language === "en" ? "Trace Inspector" : "Inspektor Penalaran AI"}
        </span>
        {isGenerating && (
          <span className="text-[11px] font-mono text-[var(--color-interactive)] animate-pulse">
            {language === "en" ? "synthesizing..." : "menganalisis..."}
          </span>
        )}
        <ChevronDown
          size={13}
          strokeWidth={1.5}
          className={`ml-auto text-[var(--color-text-muted)] transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <pre className="px-4 py-3 text-[11.5px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-wrap break-words border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 max-h-[280px] overflow-y-auto font-mono">
          {reasoning}
        </pre>
      )}
    </div>
  );
});
