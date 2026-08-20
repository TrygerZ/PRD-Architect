import { useState, useRef, useEffect } from "react";
import { Settings, Copy, Printer, PanelLeft, ChevronDown, FileText, FileType, FileJson, FileDown, Network } from "lucide-react";
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
  view?: "document" | "wbs";
  onViewChange?: (view: "document" | "wbs") => void;
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
  view = "document",
  onViewChange,
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
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed top-0 inset-x-0 h-12 bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)] z-50 flex items-center justify-between px-4 no-print"
    >
      <div className="flex items-center shrink-0 gap-2.5">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label={t.header.toggleSidebar}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
          >
            <PanelLeft size={16} strokeWidth={1.5} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[var(--color-interactive)] flex items-center justify-center text-[#080809] font-mono text-[10px] font-bold">
            P
          </div>
          <h1 className="text-[14px] font-medium tracking-tight text-[var(--color-text-primary)]">
            PRD <span className="text-[var(--color-text-muted)] font-normal">Architect</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {!minimal && hasData && (
          <div className="flex items-center gap-1 mr-1 pr-2 border-r border-[var(--color-border)]">
            {/* View tabs: Document / WBS Canvas */}
            {onViewChange && (
              <div
                role="tablist"
                aria-label={language === "en" ? "View mode" : "Mode tampilan"}
                className="flex items-center gap-0.5 p-0.5 mr-1 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)]"
              >
                <button
                  role="tab"
                  aria-selected={view === "document"}
                  onClick={() => onViewChange("document")}
                  className={`flex items-center gap-1.5 px-2 py-1 text-[11.5px] font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer ${
                    view === "document"
                      ? "bg-[var(--color-surface-highlight)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  <FileText size={12} strokeWidth={1.5} aria-hidden="true" />
                  <span className="hidden sm:inline">{t.wbs.document}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={view === "wbs"}
                  onClick={() => onViewChange("wbs")}
                  title={t.wbs.canvasLabel}
                  className={`flex items-center gap-1.5 px-2 py-1 text-[11.5px] font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer ${
                    view === "wbs"
                      ? "bg-[var(--color-surface-highlight)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Network size={12} strokeWidth={1.5} aria-hidden="true" />
                  <span className="hidden md:inline">{t.wbs.canvas}</span>
                </button>
              </div>
            )}
            <button
               onClick={onCopy}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors py-1 px-2 flex items-center gap-1.5 text-[11.5px] font-medium rounded-md hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
               aria-label={t.header.copy}
               title={t.header.copyTitle}
            >
              <Copy size={13} strokeWidth={1.5} />
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
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors py-1 px-2 flex items-center gap-1.5 text-[11.5px] font-medium rounded-md hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
                aria-label={t.header.export}
                title={t.header.export}
              >
                <FileDown size={13} strokeWidth={1.5} />
                <span className="hidden sm:inline">{t.header.export}</span>
                <ChevronDown size={11} strokeWidth={1.5} className={`transition-transform duration-150 ${exportOpen ? "rotate-180" : ""}`} />
              </button>
              {exportOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-[180px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-floating py-1 z-50"
                >
                  {exportItems.map(({ label, icon: Icon, onClick }) => (
                    <button
                      key={label}
                      role="menuitem"
                      onClick={() => runExport(onClick)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors text-left focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
                    >
                      <Icon size={13} strokeWidth={1.5} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
               onClick={onPrint}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors py-1 px-2 flex items-center gap-1.5 text-[11.5px] font-medium rounded-md hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
               aria-label={t.header.printTitle}
               title={t.header.printTitle}
            >
              <Printer size={13} strokeWidth={1.5} />
              <span className="hidden sm:inline font-mono">{t.header.print}</span>
            </button>
          </div>
        )}
        <button
          onClick={onToggleLanguage}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors text-[11.5px] font-mono px-2 py-1 rounded-md hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
          aria-label={`${t.header.toggleLanguage}: ${language.toUpperCase()}`}
          title={t.header.switchToOther}
        >
          {language === "en" ? "EN" : "ID"}
        </button>
        <button
          onClick={onOpenSettings}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-md hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer"
          aria-label={t.header.settings}
          title={t.header.settings}
        >
          <Settings size={15} strokeWidth={1.5} />
        </button>
      </div>
    </motion.header>
  );
}
