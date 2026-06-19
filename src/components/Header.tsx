import { useState, useRef, useEffect } from "react";
import { Settings, Copy, Printer, PanelLeft, ChevronDown, FileText, FileType, FileJson, FileDown } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "../hooks/useT";

interface HeaderProps {
  onOpenSettings: () => void;
  onExportMd: () => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onCopy: () => void;
  onPrint: () => void;
  hasData: boolean;
  language: "id" | "en";
  onToggleLanguage: () => void;
  minimal?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({
  onOpenSettings,
  onExportMd,
  onExportDocx,
  onExportPdf,
  onExportJson,
  onCopy,
  onPrint,
  hasData,
  language,
  onToggleLanguage,
  minimal = false,
  onToggleSidebar,
}: HeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const t = useT(language);

  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [exportOpen]);

  const runExport = (fn: () => void) => {
    fn();
    setExportOpen(false);
  };

  const exportItems: Array<{ label: string; icon: typeof FileText; onClick: () => void }> = [
    { label: t.header.exportMd, icon: FileText, onClick: onExportMd },
    { label: t.header.exportDocx, icon: FileType, onClick: onExportDocx },
    { label: t.header.exportPdf, icon: FileDown, onClick: onExportPdf },
    { label: t.header.exportJson, icon: FileJson, onClick: onExportJson },
  ];

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 inset-x-0 h-12 bg-[var(--color-bg)] border-b border-[var(--color-border)] z-50 flex items-center justify-between px-4 no-print"
    >
      <div className="flex items-center shrink-0 gap-3">
        {onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            aria-label={t.header.toggleSidebar}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-[color,transform] duration-200 ease p-2 rounded-sm hover:bg-[var(--color-surface-elevated)] mr-2 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
          >
            <PanelLeft size={18} strokeWidth={1.5} />
          </button>
        )}
        <h1 className="text-[18px] font-[600] tracking-[-0.02em] text-[var(--color-text-primary)]">
          PRD <span className="hidden sm:inline">Architect</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 ml-auto">
        {!minimal && hasData && (
          <div className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-4 pr-2 sm:pr-6 border-r border-[var(--color-border)]">
            <button
               onClick={onCopy}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-[color,transform] duration-200 ease py-2 px-3 flex items-center gap-1.5 text-[13px] font-medium rounded-[6px] hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
               aria-label={t.header.copy}
               title={t.header.copyTitle}
            >
              <Copy size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {t.header.copy}
              </span>
            </button>

            {/* Export dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-[color,transform] duration-200 ease py-2 px-3 flex items-center gap-1.5 text-[13px] font-medium rounded-sm hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
                aria-label={t.header.export}
                title={t.header.export}
              >
                <FileDown size={16} strokeWidth={1.5} />
                <span className="hidden sm:inline">{t.header.export}</span>
                <ChevronDown size={14} strokeWidth={1.5} className={`transition-transform duration-200 ${exportOpen ? "rotate-180" : ""}`} />
              </button>
              {exportOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-[200px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-2xl py-1 z-50"
                >
                  {exportItems.map(({ label, icon: Icon, onClick }) => (
                    <button
                      key={label}
                      role="menuitem"
                      onClick={() => runExport(onClick)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors text-left focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
                    >
                      <Icon size={15} strokeWidth={1.5} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
               onClick={onPrint}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-[color,transform] duration-200 ease py-2 px-3 flex items-center gap-1.5 text-[13px] font-medium rounded-sm hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
               aria-label={t.header.printTitle}
               title={t.header.printTitle}
            >
              <Printer size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline font-mono">{t.header.print}</span>
            </button>
          </div>
        )}
        <button
          onClick={onToggleLanguage}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-[color,transform] duration-200 ease text-[13px] font-mono px-3 py-2 min-h-[36px] rounded-sm hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
          aria-label={t.header.toggleLanguage}
          title={t.header.switchToOther}
        >
          {language === "en" ? "EN" : "ID"}
        </button>
        <button
          onClick={onOpenSettings}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-[color,transform] duration-200 ease p-2 rounded-sm hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
          aria-label={t.header.settings}
          title={t.header.settings}
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </motion.header>
  );
}
