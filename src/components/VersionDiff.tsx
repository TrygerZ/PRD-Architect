import { useMemo, useState, useEffect } from "react";
import { X, GitCompare } from "lucide-react";
import { diffLines, type Change } from "diff";
import { AnimatePresence, motion } from "motion/react";
import { PRDVersion } from "../types";
import { formatDate } from "../utils/format";
import { MODAL_SLIDE_UP, POPOVER_FADE } from "../utils/motion";

export interface VersionDiffProps {
  isOpen: boolean;
  onClose: () => void;
  versions: PRDVersion[];
  activeVersionId?: string | null;
  language: "id" | "en";
}

export function VersionDiff({
  isOpen,
  onClose,
  versions,
  activeVersionId,
  language,
}: VersionDiffProps) {
  const defaultRight = activeVersionId ?? versions[versions.length - 1]?.id ?? "";
  const defaultLeft = versions[versions.length - 2]?.id ?? versions[0]?.id ?? "";

  const [leftId, setLeftId] = useState<string>(defaultLeft);
  const [rightId, setRightId] = useState<string>(defaultRight);

  useEffect(() => {
    if (isOpen) {
      setRightId(activeVersionId ?? versions[versions.length - 1]?.id ?? "");
      setLeftId(versions[versions.length - 2]?.id ?? versions[0]?.id ?? "");
    }
  }, [isOpen, activeVersionId, versions]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const leftVersion = versions.find((v) => v.id === leftId);
  const rightVersion = versions.find((v) => v.id === rightId);

  const changes: Change[] = useMemo(() => {
    if (!leftVersion || !rightVersion) return [];
    return diffLines(leftVersion.content, rightVersion.content);
  }, [leftVersion, rightVersion]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const c of changes) {
      // c.value biasanya diakhiri "\n"; buang satu trailing newline agar tak
      // over-count +1 per hunk. value "" -> 0, "a\n" -> 1, "a\nb" -> 2.
      const count =
        c.count ??
        (c.value === ""
          ? 0
          : (c.value.endsWith("\n") ? c.value.slice(0, -1) : c.value).split("\n").length);
      if (c.added) added += count;
      else if (c.removed) removed += count;
    }
    return { added, removed };
  }, [changes]);

  const versionLabel = (v: PRDVersion) => {
    const idx = versions.findIndex((x) => x.id === v.id);
    const base = language === "en" ? `v${idx + 1}` : `v${idx + 1}`;
    return `${base} · ${formatDate(v.timestamp, language)}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={POPOVER_FADE}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--oa-scrim)] p-4 backdrop-blur-xs no-print"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={MODAL_SLIDE_UP}
            role="dialog"
            aria-modal="true"
            aria-labelledby="diff-dialog-title"
            className="oa-elev-popover w-full max-w-[740px] max-h-[85vh] rounded-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="oa-recessed-well w-8 h-8 rounded-xl flex items-center justify-center text-[var(--oa-accent-champagne)] shrink-0">
                  <GitCompare size={15} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h2
                  id="diff-dialog-title"
                  className="text-[15.5px] font-semibold text-[var(--oa-text-primary)] truncate"
                >
                  {language === "en" ? "Compare Versions" : "Bandingkan Versi"}
                </h2>
                <div className="oa-recessed-well hidden sm:inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-mono shrink-0">
                  <span className="text-[var(--oa-signal-sage)]">
                    +{stats.added}
                  </span>
                  <span className="text-[var(--oa-border-strong)]">/</span>
                  <span className="text-[var(--oa-signal-garnet)]">
                    -{stats.removed}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={language === "en" ? "Close" : "Tutup"}
                className="text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] p-1.5 rounded-lg hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none shrink-0"
              >
                <X size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>

            {/* Version Pickers */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-5 py-3 border-b border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)]/50 shrink-0">
              <div className="flex-1">
                <label
                  htmlFor="diff-base-version"
                  className="block text-[10.5px] font-mono text-[var(--oa-text-muted)] mb-1 uppercase tracking-[0.06em]"
                >
                  {language === "en" ? "Base (old)" : "Dasar (lama)"}
                </label>
                <select
                  id="diff-base-version"
                  value={leftId}
                  onChange={(e) => setLeftId(e.target.value)}
                  className="oa-recessed-well w-full rounded-xl px-3 py-2 text-[12.5px] font-mono text-[var(--oa-text-primary)] border-[var(--oa-border-default)] focus:outline-none focus:border-[var(--oa-border-champagne)] cursor-pointer"
                >
                  {versions.map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                      className="bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)]"
                    >
                      {versionLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label
                  htmlFor="diff-compare-version"
                  className="block text-[10.5px] font-mono text-[var(--oa-text-muted)] mb-1 uppercase tracking-[0.06em]"
                >
                  {language === "en" ? "Compare (new)" : "Banding (baru)"}
                </label>
                <select
                  id="diff-compare-version"
                  value={rightId}
                  onChange={(e) => setRightId(e.target.value)}
                  className="oa-recessed-well w-full rounded-xl px-3 py-2 text-[12.5px] font-mono text-[var(--oa-text-primary)] border-[var(--oa-border-default)] focus:outline-none focus:border-[var(--oa-border-champagne)] cursor-pointer"
                >
                  {versions.map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                      className="bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)]"
                    >
                      {versionLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Unified Diff Canvas */}
            <div className="flex-1 overflow-y-auto bg-[var(--oa-bg-recessed)] p-4 font-mono text-[12px] leading-[1.65]">
              {leftId === rightId ? (
                <p className="text-[var(--oa-text-muted)] text-center py-10">
                  {language === "en"
                    ? "Select two different versions to compare."
                    : "Pilih dua versi berbeda untuk dibandingkan."}
                </p>
              ) : (
                <div className="rounded-xl border border-[var(--oa-border-subtle)] overflow-hidden">
                  {changes.map((part, i) => {
                    const lines = part.value.replace(/\n$/, "").split("\n");
                    const rowClass = part.added
                      ? "bg-[var(--oa-signal-sage-tint)] text-[var(--oa-signal-sage)]"
                      : part.removed
                        ? "bg-[var(--oa-signal-garnet-tint)] text-[var(--oa-signal-garnet)]"
                        : "text-[var(--oa-text-muted)]";
                    const sign = part.added ? "+" : part.removed ? "-" : " ";
                    return (
                      <div key={i} className={rowClass}>
                        {lines.map((line, j) => (
                          <div key={j} className="whitespace-pre-wrap break-words px-3 py-0.5">
                            <span className="select-none opacity-65 mr-2.5">{sign}</span>
                            {line || "\u00A0"}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
