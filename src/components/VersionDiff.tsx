import { useMemo, useState, useEffect } from "react";
import { X, GitCompare } from "lucide-react";
import { diffLines, type Change } from "diff";
import { PRDVersion } from "../types";
import { formatDate } from "../utils/format";

interface VersionDiffProps {
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

  // Reset pilihan saat panel dibuka agar mengikuti versi aktif terbaru
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
      const count = c.count ?? c.value.split("\n").length;
      if (c.added) added += count;
      else if (c.removed) removed += count;
    }
    return { added, removed };
  }, [changes]);

  if (!isOpen) return null;

  const versionLabel = (v: PRDVersion) => {
    const idx = versions.findIndex((x) => x.id === v.id);
    const base = language === "en" ? `Version ${idx + 1}` : `Versi ${idx + 1}`;
    return `${base} · ${formatDate(v.timestamp, language)}`;
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--color-bg)]/80 p-4 backdrop-blur-sm no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={language === "en" ? "Compare versions" : "Bandingkan versi"}
        className="w-full max-w-[900px] max-h-[85vh] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <GitCompare size={16} strokeWidth={1.5} className="text-[var(--color-text-secondary)]" />
            {language === "en" ? "Compare Versions" : "Bandingkan Versi"}
          </h2>
          <button
            onClick={onClose}
            aria-label={language === "en" ? "Close" : "Tutup"}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-2 rounded-sm hover:bg-[var(--color-surface-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-6 py-3 border-b border-[var(--color-border)]">
          <div className="flex-1">
            <label className="block text-[11px] font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">
              {language === "en" ? "Base (old)" : "Dasar (lama)"}
            </label>
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-sm px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-interactive)]"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id} className="bg-[var(--color-bg)]">
                  {versionLabel(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">
              {language === "en" ? "Compare (new)" : "Banding (baru)"}
            </label>
            <select
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-sm px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-interactive)]"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id} className="bg-[var(--color-bg)]">
                  {versionLabel(v)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 py-2 border-b border-[var(--color-border)] text-[12px] font-mono">
          <span className="text-[var(--color-success)]">+{stats.added} {language === "en" ? "added" : "tambah"}</span>
          <span className="text-[var(--color-error)]">-{stats.removed} {language === "en" ? "removed" : "hapus"}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-[1.6]">
          {leftId === rightId ? (
            <p className="text-[var(--color-text-muted)] text-center py-8">
              {language === "en"
                ? "Select two different versions to compare."
                : "Pilih dua versi berbeda untuk dibandingkan."}
            </p>
          ) : (
            changes.map((part, i) => {
              const lines = part.value.replace(/\n$/, "").split("\n");
              const bg = part.added
                ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                : part.removed
                  ? "bg-[var(--color-error)]/10 text-[var(--color-error)]"
                  : "text-[var(--color-text-muted)]";
              const sign = part.added ? "+" : part.removed ? "-" : " ";
              return (
                <div key={i} className={bg}>
                  {lines.map((line, j) => (
                    <div key={j} className="whitespace-pre-wrap break-words px-2">
                      <span className="select-none opacity-60 mr-2">{sign}</span>
                      {line || "\u00A0"}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
