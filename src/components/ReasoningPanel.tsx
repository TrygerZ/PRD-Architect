import { memo, useEffect, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";

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
    <div className="border border-[var(--color-border)] rounded-md mb-4 bg-[var(--color-surface)] no-print">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none rounded-md"
      >
        <Brain
          size={14}
          strokeWidth={1.5}
          className={isGenerating ? "animate-pulse text-[var(--color-interactive)]" : ""}
        />
        <span className="font-medium">
          {language === "en" ? "AI Reasoning" : "Penalaran AI"}
        </span>
        {isGenerating && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {language === "en" ? "thinking..." : "berpikir..."}
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={`ml-auto transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <pre className="px-4 py-3 text-[12px] leading-[1.6] text-[var(--color-text-muted)] whitespace-pre-wrap break-words border-t border-[var(--color-border)] max-h-[320px] overflow-y-auto font-mono">
          {reasoning}
        </pre>
      )}
    </div>
  );
});
