import { memo } from "react";
import { Plus, MessageSquareText, X, FileText, Clock } from "lucide-react";
import { PRDVersion } from "../types";
import { formatDate } from "../utils/format";

interface SidebarProps {
  versions: PRDVersion[];
  activeVersionId: string | null;
  onSwitchVersion: (id: string) => void;
  onNewPRD: () => void;
  language: "id" | "en";
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = memo(function Sidebar({
  versions,
  activeVersionId,
  onSwitchVersion,
  onNewPRD,
  language,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[55] lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        role="region"
        aria-label={language === "en" ? "Sidebar navigation" : "Navigasi sidebar"}
        className={`
          h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto shrink-0
          transition-transform duration-200 ease-out flex flex-col
          ${isOpen
            ? "fixed lg:relative translate-x-0 lg:translate-x-0 z-[60] lg:z-auto w-[270px] sm:w-[300px]"
            : "fixed lg:relative -translate-x-full lg:translate-x-0 lg:w-[270px] lg:min-w-[270px] w-[270px] sm:w-[300px]"
          }
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 lg:hidden p-2 rounded-lg hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
          aria-label={language === "en" ? "Close sidebar" : "Tutup sidebar"}
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* New PRD button */}
        <div className="p-3">
          <button
            onClick={onNewPRD}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-highlight)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] font-medium transition-all duration-150 cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
          >
            <Plus size={15} strokeWidth={2} className="text-[var(--color-interactive)]" />
            <span>{language === "en" ? "New Document" : "Dokumen Baru"}</span>
          </button>
        </div>

        {/* History label */}
        <div className="px-4 py-2 flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
          <Clock size={12} strokeWidth={1.5} />
          <span>{language === "en" ? "Recent Documents" : "Riwayat Dokumen"}</span>
        </div>

        {versions.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquareText size={20} strokeWidth={1.5} className="text-[var(--color-text-muted)] mx-auto mb-2 opacity-60" />
            <p className="text-[12px] text-[var(--color-text-muted)]">
              {language === "en" ? "No documents generated yet" : "Belum ada dokumen yang dibuat"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-2 pb-4">
            {[...versions].reverse().map((v, i) => {
              const isActive = v.id === activeVersionId;
              const promptTitle = (v.userDisplayPrompt || v.prompt)
                ? ((v.userDisplayPrompt || v.prompt).length > 50 ? (v.userDisplayPrompt || v.prompt).slice(0, 50) + '...' : (v.userDisplayPrompt || v.prompt))
                : (v.productType !== "Unknown" ? v.productType : (language === "en" ? "Draft Spec" : "Draf Spesifikasi"));

              return (
                <button
                  key={v.id}
                  className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 cursor-pointer border ${
                    isActive
                      ? "bg-[var(--color-surface-elevated)] border-[var(--color-interactive)]/40 shadow-xs"
                      : "bg-transparent border-transparent hover:bg-[var(--color-surface-elevated)]/50 hover:border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  }`}
                  onClick={() => onSwitchVersion(v.id)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">
                      {language === "en" ? `Version ${versions.length - i}` : `Versi ${versions.length - i}`}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] shrink-0">
                      {v.prdMode ? v.prdMode.toUpperCase() : "PRD"}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--color-text-secondary)] line-clamp-1 mb-1.5 leading-snug">
                    {promptTitle}
                  </div>
                  <time dateTime={new Date(v.timestamp).toISOString()} className="text-[10.5px] text-[var(--color-text-muted)] font-mono block">
                    {formatDate(v.timestamp, language)}
                  </time>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
});
