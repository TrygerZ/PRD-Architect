import { Settings, Download, Copy, Printer, PanelLeft } from "lucide-react";
import { motion } from "motion/react";

interface HeaderProps {
  onOpenSettings: () => void;
  onExportMd: () => void;
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
  onCopy,
  onPrint,
  hasData,
  language,
  onToggleLanguage,
  minimal = false,
  onToggleSidebar,
}: HeaderProps) {
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
            aria-label="Toggle Sidebar"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 ease p-1.5 rounded-[6px] hover:bg-[var(--color-surface-elevated)] mr-2 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
          >
            <PanelLeft size={18} strokeWidth={1.5} />
          </button>
        )}
        <h1 className="text-[18px] sm:text-[18px] font-[600] tracking-[-0.02em] text-[var(--color-text-primary)]">
          PRD <span className="hidden sm:inline">Architect</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 ml-auto">
        {!minimal && hasData && (
          <div className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-4 pr-2 sm:pr-6 border-r border-[var(--color-border)]">
            {/* Export buttons */}
            <button
               onClick={onCopy}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 ease py-1.5 px-2 flex items-center gap-1.5 text-[13px] font-medium rounded-[6px] hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
               aria-label={language === "en" ? "Copy as Text" : "Salin Text"}
               title={language === "en" ? "Copy as Text" : "Salin Text"}
            >
              <Copy size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {language === "en" ? "Copy" : "Salin"}
              </span>
            </button>
            <button
               onClick={onExportMd}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 ease py-1.5 px-2 flex items-center gap-1.5 text-[13px] font-medium rounded-[6px] hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
               aria-label={language === "en" ? "Download Markdown" : "Unduh Markdown"}
               title={language === "en" ? "Download Markdown" : "Unduh Markdown"}
            >
              <Download size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline font-mono">MD</span>
            </button>
            <button
               onClick={onPrint}
               className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 ease py-1.5 px-2 flex items-center gap-1.5 text-[13px] font-medium rounded-[6px] hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
               aria-label={language === "en" ? "Print to PDF" : "Cetak PDF"}
               title={language === "en" ? "Print to PDF" : "Cetak PDF"}
            >
              <Printer size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline font-mono">PDF</span>
            </button>
          </div>
        )}
        <button
          onClick={onToggleLanguage}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 ease text-[13px] font-mono px-2 py-1.5 rounded-[6px] hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
          aria-label={language === "en" ? "Toggle Language" : "Ganti Bahasa"}
          title={
            language === "en"
              ? "Switch to Indonesian"
              : "Ganti ke Bahasa Inggris"
          }
        >
          {language === "en" ? "EN" : "ID"}
        </button>
        <button
          onClick={onOpenSettings}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 ease p-1.5 rounded-[6px] hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
          aria-label={language === "en" ? "Settings" : "Pengaturan"}
          title={language === "en" ? "Settings" : "Pengaturan"}
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </motion.header>
  );
}
