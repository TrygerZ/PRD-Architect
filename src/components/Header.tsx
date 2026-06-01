import { Settings, Download, Copy, Printer, List } from "lucide-react";
import { motion } from "motion/react";

interface HeaderProps {
  onOpenSettings: () => void;
  onExportMd: () => void;
  onCopy: () => void;
  onPrint: () => void;
  onToggleToC?: () => void;
  hasData: boolean;
  language: "id" | "en";
  onToggleLanguage: () => void;
}

export function Header({
  onOpenSettings,
  onExportMd,
  onCopy,
  onPrint,
  onToggleToC,
  hasData,
  language,
  onToggleLanguage,
}: HeaderProps) {
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 inset-x-0 h-14 bg-[#111111] border-b border-[#2a2a2a] z-50 flex items-center justify-between px-6 no-print"
    >
      <div className="flex items-center shrink-0 gap-3">
        {hasData && onToggleToC && (
          <button 
            onClick={onToggleToC}
            aria-label={language === "en" ? "Toggle Table of Contents" : "Tampilkan Daftar Isi"}
            className="text-[#999999] hover:text-[#f5f5f5] transition-all duration-200 ease p-1 rounded-[6px] hover:bg-[#222222]"
            title={language === "en" ? "Toggle Table of Contents" : "Tampilkan Daftar Isi"}
          >
            <List size={16} strokeWidth={1.5} />
          </button>
        )}
        <h1 className="text-[18px] sm:text-[18px] font-semibold tracking-[-0.02em] text-[#f5f5f5] font-body">
          PRD <span className="hidden sm:inline">Architect</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 ml-auto">
        {hasData && (
          <div className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-4 pr-2 sm:pr-6 border-r border-[#2a2a2a]">
            <button
               onClick={onCopy}
               className="text-[#999999] hover:text-[#f5f5f5] transition-all duration-200 ease py-1.5 px-2 flex items-center gap-1.5 text-[13px] font-medium rounded-[6px] hover:bg-[#222222]"
               title={language === "en" ? "Copy as Text" : "Salin Text"}
            >
              <Copy size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline font-body">
                {language === "en" ? "Copy" : "Salin"}
              </span>
            </button>
            <button
               onClick={onExportMd}
               className="text-[#999999] hover:text-[#f5f5f5] transition-all duration-200 ease py-1.5 px-2 flex items-center gap-1.5 text-[13px] font-medium rounded-[6px] hover:bg-[#222222]"
               title={language === "en" ? "Download Markdown" : "Unduh Markdown"}
            >
              <Download size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline font-mono">MD</span>
            </button>
            <button
               onClick={onPrint}
               className="text-[#999999] hover:text-[#f5f5f5] transition-all duration-200 ease py-1.5 px-2 flex items-center gap-1.5 text-[13px] font-medium rounded-[6px] hover:bg-[#222222]"
               title={language === "en" ? "Print to PDF" : "Cetak PDF"}
            >
              <Printer size={16} strokeWidth={1.5} />
              <span className="hidden sm:inline font-mono">PDF</span>
            </button>
          </div>
        )}
        <button
          onClick={onToggleLanguage}
          className="text-[#999999] hover:text-[#f5f5f5] transition-all duration-200 ease text-[13px] font-mono hidden sm:block px-2 py-1.5 rounded-[6px] hover:bg-[#222222]"
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
          className="text-[#999999] hover:text-[#f5f5f5] transition-all duration-200 ease p-1.5 rounded-[6px] hover:bg-[#222222]"
          title={language === "en" ? "Settings" : "Pengaturan"}
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </motion.header>
  );
}
