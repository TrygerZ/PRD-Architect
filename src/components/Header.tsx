import { useState, useRef, useEffect } from "react";
import {
  Settings,
  Copy,
  Printer,
  PanelLeft,
  ChevronDown,
  FileText,
  FileType,
  FileJson,
  FileDown,
  Network,
  GitCompare,
  Sun,
  Moon,
  Check,
  Repeat,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { PRDMode } from "../../shared/types";
import type { ThemeMode } from "../utils/theme";
import { POPOVER_FADE } from "../utils/motion";
import { useT } from "../hooks/useT";
import { BrandMark } from "./BrandMark";

export interface HeaderProps {
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
  theme: ThemeMode;
  onToggleTheme: () => void;
  minimal?: boolean;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  view?: "document" | "wbs";
  onViewChange?: (view: "document" | "wbs") => void;
  versionsCount?: number;
  activeVersionLabel?: string;
  activeMode?: PRDMode;
  onOpenDiff?: () => void;
  onConvertMode?: (mode: PRDMode) => void;
  isGenerating?: boolean;
}

const MODE_DOT_CLASSES: Record<PRDMode, string> = {
  business: "bg-[var(--oa-signal-ochre)]",
  simple: "bg-[var(--oa-signal-sage)]",
  technical: "bg-[var(--oa-signal-steel)]",
};

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
  theme,
  onToggleTheme,
  minimal = false,
  onToggleSidebar,
  sidebarOpen = true,
  view = "document",
  onViewChange,
  versionsCount = 0,
  activeVersionLabel,
  activeMode,
  onOpenDiff,
  onConvertMode,
  isGenerating = false,
}: HeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const convertRef = useRef<HTMLDivElement>(null);
  const t = useT(language);

  useEffect(() => {
    if (!exportOpen && !convertOpen) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (exportOpen && exportRef.current && !exportRef.current.contains(target)) {
        setExportOpen(false);
      }
      if (convertOpen && convertRef.current && !convertRef.current.contains(target)) {
        setConvertOpen(false);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExportOpen(false);
        setConvertOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [exportOpen, convertOpen]);

  const runExport = (fn: () => void) => {
    fn();
    setExportOpen(false);
  };

  const handleSelectMode = (mode: PRDMode) => {
    setConvertOpen(false);
    if (!isGenerating && mode !== activeMode) {
      onConvertMode?.(mode);
    }
  };

  const exportItems: Array<{ label: string; icon: typeof FileText; onClick: () => void }> = [
    { label: t.header.exportMd, icon: FileText, onClick: onExportMd },
    { label: t.header.exportDocx, icon: FileType, onClick: onExportDocx },
    { label: t.header.exportPdf, icon: FileDown, onClick: onExportPdf },
    { label: t.header.exportJson, icon: FileJson, onClick: onExportJson },
  ];

  const convertOptions: Array<{ mode: PRDMode; label: string }> = [
    { mode: "business", label: t.welcome.businessMode },
    { mode: "simple", label: t.welcome.simpleMode },
    { mode: "technical", label: t.welcome.technicalMode },
  ];

  return (
    <header className="h-[52px] shrink-0 bg-[var(--oa-bg-canvas)]/92 backdrop-blur-md border-b border-[var(--oa-border-subtle)] flex items-center justify-between gap-2 px-3 sm:px-4 z-30 no-print">
      {/* Left section */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <div
            className={
              sidebarOpen
                ? "flex items-center gap-2 shrink-0 lg:hidden"
                : "flex items-center gap-2 shrink-0"
            }
          >
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={t.sidebar.expand}
              title={t.sidebar.expand}
              className="p-1.5 rounded-lg text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              <PanelLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            {!sidebarOpen && <BrandMark size={24} />}
          </div>
        )}

        {minimal ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] min-w-0">
            <span className="text-[var(--oa-text-muted)] truncate">
              {t.header.workspaceBreadcrumb}
            </span>
            <span className="text-[var(--oa-text-muted)]/60" aria-hidden="true">
              /
            </span>
            <span className="text-[var(--oa-text-primary)] font-medium truncate">
              {t.header.newSpecBreadcrumb}
            </span>
          </nav>
        ) : (
          hasData && (
            <div className="flex items-center gap-1.5 min-w-0">
              {onViewChange && (
                <div
                  role="tablist"
                  aria-label={language === "en" ? "View mode" : "Mode tampilan"}
                  className="oa-recessed-well flex items-center gap-0.5 p-0.5 rounded-lg shrink-0"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "document"}
                    onClick={() => onViewChange("document")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                      view === "document"
                        ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] shadow-subtle"
                        : "text-[var(--oa-text-muted)] hover:text-[var(--oa-text-secondary)]"
                    }`}
                  >
                    <FileText size={12} strokeWidth={1.5} aria-hidden="true" />
                    <span className="hidden sm:inline">{t.wbs.document}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "wbs"}
                    onClick={() => onViewChange("wbs")}
                    title={t.wbs.canvasLabel}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                      view === "wbs"
                        ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] shadow-subtle"
                        : "text-[var(--oa-text-muted)] hover:text-[var(--oa-text-secondary)]"
                    }`}
                  >
                    <Network size={12} strokeWidth={1.5} aria-hidden="true" />
                    <span className="hidden md:inline">{t.wbs.canvas}</span>
                  </button>
                </div>
              )}

              {activeVersionLabel && (
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[11px] font-mono text-[var(--oa-text-secondary)] shrink-0">
                  {activeVersionLabel}
                </span>
              )}

              {versionsCount > 1 && onOpenDiff && (
                <button
                  type="button"
                  onClick={onOpenDiff}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none shrink-0"
                  aria-label={t.header.diff}
                  title={t.header.diff}
                >
                  <GitCompare size={13} strokeWidth={1.5} aria-hidden="true" />
                  <span className="hidden lg:inline">{t.header.diff}</span>
                </button>
              )}

              {onConvertMode && (
                <div className="relative shrink-0" ref={convertRef}>
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => {
                      setExportOpen(false);
                      setConvertOpen((prev) => !prev);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={convertOpen}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 disabled:opacity-45 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                    aria-label={t.header.convertMode}
                    title={t.header.convertMode}
                  >
                    <Repeat size={12} strokeWidth={1.5} aria-hidden="true" />
                    <span className="hidden xl:inline">{t.header.convertMode}</span>
                    <ChevronDown
                      size={11}
                      strokeWidth={1.5}
                      className={`transition-transform duration-150 ${convertOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>

                  <AnimatePresence>
                    {convertOpen && (
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={POPOVER_FADE}
                        className="absolute left-0 mt-1.5 w-[224px] oa-elev-popover rounded-xl py-1.5 z-50"
                      >
                        {convertOptions.map(({ mode, label }) => {
                          const isCurrent = activeMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              role="menuitem"
                              disabled={isCurrent || isGenerating}
                              onClick={() => handleSelectMode(mode)}
                              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 disabled:opacity-60 disabled:cursor-default transition-colors text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${MODE_DOT_CLASSES[mode]}`}
                                  aria-hidden="true"
                                />
                                <span className="truncate">{label}</span>
                              </span>
                              {isCurrent && (
                                <Check
                                  size={12}
                                  strokeWidth={2}
                                  className="text-[var(--oa-accent-champagne)] shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!minimal && hasData && (
          <div className="flex items-center gap-1 pr-2 mr-0.5 border-r border-[var(--oa-border-subtle)]">
            <button
              type="button"
              onClick={onCopy}
              className="text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] transition-colors py-1 px-2 flex items-center gap-1.5 text-[11.5px] font-medium rounded-md hover:bg-[var(--oa-bg-hover)]/60 focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none cursor-pointer"
              aria-label={t.header.copy}
              title={t.header.copyTitle}
            >
              <Copy size={13} strokeWidth={1.5} aria-hidden="true" />
              <span className="hidden sm:inline">{t.header.copy}</span>
            </button>

            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => {
                  setConvertOpen(false);
                  setExportOpen((prev) => !prev);
                }}
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                className="text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] transition-colors py-1 px-2 flex items-center gap-1.5 text-[11.5px] font-medium rounded-md hover:bg-[var(--oa-bg-hover)]/60 focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none cursor-pointer"
                aria-label={t.header.export}
                title={t.header.export}
              >
                <FileDown size={13} strokeWidth={1.5} aria-hidden="true" />
                <span className="hidden sm:inline">{t.header.export}</span>
                <ChevronDown
                  size={11}
                  strokeWidth={1.5}
                  className={`transition-transform duration-150 ${exportOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence>
                {exportOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={POPOVER_FADE}
                    className="absolute right-0 mt-1.5 w-[196px] oa-elev-popover rounded-xl py-1.5 z-50"
                  >
                    {exportItems.map(({ label, icon: Icon, onClick }) => (
                      <button
                        key={label}
                        type="button"
                        role="menuitem"
                        onClick={() => runExport(onClick)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors text-left focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none cursor-pointer"
                      >
                        <Icon size={13} strokeWidth={1.5} aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    ))}
                    <div
                      className="my-1 border-t border-[var(--oa-border-subtle)]"
                      role="separator"
                    />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runExport(onPrint)}
                      title={t.header.printTitle}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors text-left focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none cursor-pointer"
                    >
                      <Printer size={13} strokeWidth={1.5} aria-hidden="true" />
                      <span>{t.header.print}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? t.theme.switchToLight : t.theme.switchToDark}
          title={theme === "dark" ? t.theme.switchToLight : t.theme.switchToDark}
          className="p-1.5 rounded-lg text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
        >
          {theme === "dark" ? (
            <Sun size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Moon size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleLanguage}
          aria-label={`${t.header.toggleLanguage}: ${language.toUpperCase()}`}
          title={t.header.switchToOther}
          className="oa-recessed-well inline-flex items-center p-0.5 rounded-lg text-[10.5px] font-mono cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
        >
          <span
            className={`px-1.5 py-0.5 rounded-md transition-colors ${
              language === "en"
                ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] shadow-subtle"
                : "text-[var(--oa-text-muted)]"
            }`}
          >
            EN
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md transition-colors ${
              language === "id"
                ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] shadow-subtle"
                : "text-[var(--oa-text-muted)]"
            }`}
          >
            ID
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none cursor-pointer"
          aria-label={t.header.settings}
          title={t.header.settings}
        >
          <Settings size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
