import { Settings, Download, Copy, Printer } from "lucide-react";

interface HeaderProps {
  onOpenSettings: () => void;
  onExportMd: () => void;
  onCopy: () => void;
  onPrint: () => void;
  hasData: boolean;
  language: "id" | "en";
  onToggleLanguage: () => void;
}

export function Header({
  onOpenSettings,
  onExportMd,
  onCopy,
  onPrint,
  hasData,
  language,
  onToggleLanguage,
}: HeaderProps) {
  return (
    <header className="fixed top-0 inset-x-0 h-16 glass-panel border-b-cyber-border z-50 flex items-center justify-between px-3 sm:px-6 no-print">
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded bg-cyber-accent/20 border border-cyber-accent flex items-center justify-center">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-cyber-accent rounded-sm animate-pulse" />
        </div>
        <h1 className="text-sm sm:text-xl font-mono tracking-widest text-cyber-text uppercase whitespace-nowrap">
          PRD{" "}
          <span className="hidden sm:inline text-cyber-accent">Architect</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 ml-auto">
        {hasData && (
          <div className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-4 border-r border-cyber-border pr-2 sm:pr-6">
            <button
              onClick={onCopy}
              className="cyber-button text-xs py-1.5 px-2 sm:px-3 flex items-center gap-1"
              title={language === "en" ? "Copy as Text" : "Salin Text"}
            >
              <Copy size={14} />{" "}
              <span className="hidden sm:inline">
                {language === "en" ? "Copy" : "Salin"}
              </span>
            </button>
            <button
              onClick={onExportMd}
              className="cyber-button text-xs py-1.5 px-2 sm:px-3 flex items-center gap-1"
              title={language === "en" ? "Download Markdown" : "Unduh Markdown"}
            >
              <Download size={14} />{" "}
              <span className="hidden sm:inline">.MD</span>
            </button>
            <button
              onClick={onPrint}
              className="cyber-button text-xs py-1.5 px-2 sm:px-3 flex items-center gap-1"
              title={language === "en" ? "Print to PDF" : "Cetak PDF"}
            >
              <Printer size={14} />{" "}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        )}
        <button
          onClick={onToggleLanguage}
          className="px-2 py-1 text-xs border border-cyber-border rounded text-cyber-text-dim hover:text-cyber-accent hover:border-cyber-accent transition-colors hidden sm:block"
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
          className="p-1.5 sm:p-2 text-cyber-text-dim hover:text-cyber-accent transition-colors"
          title={language === "en" ? "Settings" : "Pengaturan"}
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
