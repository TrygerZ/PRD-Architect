import { memo } from "react";
import { FileText, MessageSquareText, X } from "lucide-react";
import { PRDVersion } from "../types";

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
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(language === "en" ? "en-US" : "id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] lg:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={`
          h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto shrink-0
          transition-transform duration-200 ease-in-out flex flex-col
          ${isOpen
            ? "fixed lg:relative translate-x-0 lg:translate-x-0 z-[60] lg:z-auto w-[280px] sm:w-[320px]"
            : "fixed lg:relative -translate-x-full lg:translate-x-0 lg:w-[280px] lg:min-w-[280px] w-[280px] sm:w-[320px]"
          }
        `}
      >
        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 lg:hidden p-1.5 rounded-md hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
          aria-label={language === "en" ? "Close sidebar" : "Tutup sidebar"}
        >
          <X size={18} strokeWidth={1.5} />
        </button>
        <button 
          onClick={onNewPRD}
          className="w-full flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-all duration-200 text-[14px] font-medium focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
        >
          <FileText size={16} strokeWidth={1.5} />
          {language === "en" ? "+ New PRD" : "+ PRD Baru"}
        </button>

      <div className="px-4 py-2 mt-2 text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
        {language === "en" ? "History" : "Riwayat"}
      </div>

      {versions.length === 0 ? (
        <div className="p-6 text-center">
          <MessageSquareText size={24} strokeWidth={1.5} className="text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {language === "en" ? "No PRD generated yet" : "Belum ada PRD yang di-generate"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col mt-2">
          {[...versions].reverse().map((v, i) => (
            <button
              key={v.id}
              className="w-full text-left px-4 py-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-elevated)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
              onClick={() => onSwitchVersion(v.id)}
              aria-current={v.id === activeVersionId ? "page" : undefined}
              style={{
                background: v.id === activeVersionId ? 'var(--color-surface-elevated)' : 'transparent',
                borderLeft: v.id === activeVersionId ? '2px solid var(--color-interactive)' : '2px solid transparent'
              }}
            >
              <div className="text-[13px] font-medium text-[var(--color-text-primary)]">
                {language === "en" ? `Version ${versions.length - i}` : `Versi ${versions.length - i}`}
              </div>
              <time dateTime={new Date(v.timestamp).toISOString()} className="text-[11px] text-[var(--color-text-muted)] font-mono mt-1">
                {formatDate(v.timestamp)}
              </time>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                {v.prompt ? (v.prompt.length > 60 ? v.prompt.slice(0, 60) + '...' : v.prompt) : (v.productType !== "Unknown" ? v.productType : "Draft")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
    </>
  );
});
