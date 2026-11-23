import { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ChatInput } from "./components/ChatInput";
import { BlueprintSheet } from "./components/BlueprintSheet";
import { ProductType, UploadedFile, AIProvider, PRDMode } from "../shared/types";
import { getChapterBlock, MAX_CUSTOM_BLOCKS } from "../shared/chapterBlocks";
import type { PRDVersion } from "./types";
import DOMPurify from "dompurify";
import { ArrowUp, ArrowDown, X, AlertCircle, AlertTriangle, Check } from "lucide-react";
import { safeGetLocalStorage, safeSetLocalStorage, serializeDraft, parseDraft } from "./utils/storage";
import { MAX_PERSISTED_VERSIONS } from "./utils/persistence";
import { buildChapterOutline } from "./utils/outline";
import { MODAL_SLIDE_UP, POPOVER_FADE } from "./utils/motion";
import { WBS_SECTION_RE } from "./utils/wbsTable";
import { buildPrintHtml, downloadMarkdown } from "./utils/printTemplate";
import { useSettings } from "./hooks/useSettings";
import { useTheme } from "./hooks/useTheme";
import { useT } from "./hooks/useT";
import { useToast } from "./hooks/useToast";
import { useScroll } from "./hooks/useScroll";
import { useVersion } from "./hooks/useVersion";
import { useGeneration } from "./hooks/useGeneration";

import { Sidebar } from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ReasoningPanel } from "./components/ReasoningPanel";
import { SmartRevisionDock } from "./components/SmartRevisionDock";
import { VersionDiff } from "./components/VersionDiff";

// Task 2.6 — Code-splitting: modal & uploader di-load hanya saat dipakai.
const ApiKeyModal = lazy(() =>
  import("./components/ApiKeyModal").then((m) => ({ default: m.ApiKeyModal })),
);
const FileUploader = lazy(() =>
  import("./components/FileUploader").then((m) => ({ default: m.FileUploader })),
);
const WbsCanvas = lazy(() =>
  import("./components/WbsCanvas").then((m) => ({ default: m.WbsCanvas })),
);

const PROVIDER_LABELS: Record<AIProvider, string> = {
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  opencode: "OpenCode Zen",
  nine_router: "9Router Proxy",
};

const DRAFT_KEY = "PRD_DRAFT";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const { provider, model, customEndpoint, persistSettings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [productType, setProductType] = useState<ProductType>("Unknown");
  const [language, setLanguage] = useState<"id" | "en">("en");
  const t = useT(language);
  const { showScrollTop, showScrollBottom, handleScroll: onContainerScroll } = useScroll();
  const { toastMessage, showToast } = useToast();

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showUploader, setShowUploader] = useState(false);

  const {
    versions,
    setVersions,
    activeVersionId,
    setActiveVersionId,
    activeVersion,
    comments,
    setComments,
    handleNewPRD: versionNewPRD,
    handleSwitchVersion: versionSwitchVersion,
    handleCommentChange: versionCommentChange,
  } = useVersion((reason) => {
    // D-01c — surface kegagalan autosave (mis. quota IndexedDB) ke UI.
    if (reason === "quota") {
      showToast(
        language === "en"
          ? "Storage full: older versions may not be saved."
          : "Penyimpanan penuh: versi lama mungkin tidak tersimpan.",
      );
    }
  });

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>(undefined);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState<string>(() =>
    parseDraft(safeGetLocalStorage(DRAFT_KEY), DRAFT_TTL_MS),
  );
  const [prdMode, setPrdMode] = useState<PRDMode>("business");
  const [view, setView] = useState<"document" | "wbs">("document");

  // Custom PRD builder — lifted from WelcomeScreen/CustomPrdBuilder to App (single source of truth)
  const STORAGE_KEY_TAB = "PRD_BUILDER_TAB";
  const STORAGE_KEY_BLOCKS = "PRD_CUSTOM_BLOCKS";
  const getInitialTab = (): "standard" | "custom" => {
    const raw = safeGetLocalStorage(STORAGE_KEY_TAB, "");
    return raw === "custom" ? "custom" : "standard";
  };
  const loadInitialIds = (): string[] => {
    const raw = safeGetLocalStorage(STORAGE_KEY_BLOCKS, "");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const v of parsed) {
        if (typeof v !== "string" || seen.has(v) || !getChapterBlock(v)) continue;
        seen.add(v);
        out.push(v);
        if (out.length >= MAX_CUSTOM_BLOCKS) break;
      }
      return out;
    } catch {
      return [];
    }
  };
  const [builderTab, setBuilderTab] = useState<"standard" | "custom">(() => getInitialTab());
  const [customChapterIds, setCustomChapterIds] = useState<string[]>(() => loadInitialIds());

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef(language);
  const prdModeRef = useRef(prdMode);

  // Ref untuk menghindari stale closure — selalu merefleksikan activeVersion terbaru
  // saat handleAppend / handleRevise dipanggil setelah pergantian versi cepat
  const activeVersionRef = useRef<PRDVersion | undefined>(versions.find((v) => v.id === activeVersionId));
  const commentsRef = useRef(comments);
  const builderTabRef = useRef<"standard" | "custom">(builderTab);
  const customChapterIdsRef = useRef<string[]>(customChapterIds);

  // Task 2.3 — Logika generasi dipindah ke hook useGeneration.
  const {
    isGenerating,
    isConnecting,
    continuingStatus,
    truncatedByVersion,
    error,
    setError,
    abortGeneration,
    handleCancel,
    handleGenerate,
    handleAppend,
    handleRevise,
    handleContinue,
    handleConvertMode,
  } = useGeneration({
    customApiKey,
    provider,
    model,
    customEndpoint,
    uploadedFiles,
    languageRef,
    prdModeRef,
    commentsRef,
    activeVersionRef,
    setVersions,
    setActiveVersionId,
    setComments,
    setPrdMode,
    setBuilderTab,
    setProductType,
    builderTabRef,
    customChapterIdsRef,
  });

  const handleNewPRD = useCallback(() => {
    // Task 3.11 — Confirm dialog jika sudah ada versi
    if (versions.length > 0) {
      const confirmed = window.confirm(
        language === 'en' ? 'Delete all PRD history?' : 'Hapus semua riwayat PRD?'
      );
      if (!confirmed) return;
    }

    // CRIT-06 fix — Abort any in-flight generation BEFORE resetting state.
    // Pembatalan dikelola oleh hook useGeneration via abortGeneration.
    abortGeneration();
    versionNewPRD(false, abortGeneration);
    setComposerDraft("");
    safeSetLocalStorage(DRAFT_KEY, "");
    setUploadedFiles([]);
    setActiveSectionId(undefined);
  }, [versionNewPRD, abortGeneration, versions.length, language]);

  // showToast now provided by useToast hook

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(printTimerRef.current);
    };
  }, []);

  // Debounced draft persistence across Hero <-> Custom <-> Dock and Document <-> WBS transitions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (composerDraft.trim()) {
        safeSetLocalStorage(DRAFT_KEY, serializeDraft(composerDraft));
      } else {
        safeSetLocalStorage(DRAFT_KEY, "");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [composerDraft]);

  // Load preferensi bahasa dari localStorage (default "en")
  useEffect(() => {
    const VALID_LANGUAGES: Array<"id" | "en"> = ["id", "en"];
    const storedLang = safeGetLocalStorage("PRD_LANGUAGE");
    if (storedLang && VALID_LANGUAGES.includes(storedLang as "id" | "en")) {
      setLanguage(storedLang as "id" | "en");
    }
  }, []);

  // Sync html lang attribute with language state — penting untuk aksesibilitas screen reader
  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "id";
  }, [language]);

  // P4 — beforeunload: cegah kehilangan data saat user menutup tab
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isGenerating || versions.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires this
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isGenerating, versions.length]);

  // P6 — popstate guard: cegah back button meninggalkan app tanpa konfirmasi
  useEffect(() => {
    // Push initial state untuk mencegah back button meninggalkan app
    if (window.history.length <= 1) {
      window.history.pushState({ app: 'prd-architect' }, '', window.location.href);
    }
    
    const handlePopState = (_e: PopStateEvent) => {
      // Jika user mencoba back dan ada data yang belum disimpan
      if (isGenerating || versions.length > 0) {
        const confirmLeave = window.confirm(
          language === 'en' 
            ? 'You have unsaved PRD content. Leave anyway?' 
            : 'Anda memiliki konten PRD yang belum disimpan. Tetap tinggalkan?'
        );
        if (!confirmLeave) {
          window.history.pushState({ app: 'prd-architect' }, '', window.location.href);
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGenerating, versions.length, language]);

  // Global Ctrl+K / Cmd+K shortcut for New PRD when no modal/overlay is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (isSettingsOpen || isDiffOpen || showUploader) return;
        e.preventDefault();
        handleNewPRD();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewPRD, isSettingsOpen, isDiffOpen, showUploader]);

  // Close FileUploader modal on Escape
  useEffect(() => {
    if (!showUploader) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowUploader(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showUploader]);

  // Persist builder tab
  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEY_TAB, builderTab);
  }, [builderTab]);

  // Selalu sinkronkan ref dengan activeVersion terbaru (untuk handleAppend/handleRevise)
  useEffect(() => {
    activeVersionRef.current = activeVersion;
    commentsRef.current = comments;
    languageRef.current = language;
    prdModeRef.current = prdMode;
    builderTabRef.current = builderTab;
    customChapterIdsRef.current = customChapterIds;
  }, [activeVersion, comments, language, prdMode, builderTab, customChapterIds]);

  const prdContent = activeVersion?.content || "";
  const hasMessage = !!activeVersionId || versions.length > 0;
  const userPrompt = activeVersion?.prompt || "";

  const outlineItems = useMemo(
    () => buildChapterOutline(prdContent, comments, isGenerating),
    [prdContent, comments, isGenerating],
  );

  const activeVersionIndex = useMemo(
    () => (activeVersionId ? versions.findIndex((v) => v.id === activeVersionId) : -1),
    [versions, activeVersionId],
  );
  const activeVersionLabel = activeVersionIndex >= 0 ? `v${activeVersionIndex + 1}` : undefined;
  const providerLabel = PROVIDER_LABELS[provider];

  useEffect(() => {
    setActiveSectionId(undefined);
  }, [activeVersionId]);

  // Reset view ke document saat tidak ada konten (PRD baru / cleared).
  useEffect(() => {
    if (!prdContent && view === "wbs") setView("document");
  }, [prdContent, view]);

  // ============================================================
  // Task 2.3 — Logika generasi (executeGeneration, handleGenerate,
  // handleAppend, handleRevise, handleConvertMode) kini di hook
  // useGeneration. App tinggal memanggil handler yang sudah dibungkus.
  // ============================================================

  const handleExportMd = () => {
    if (!prdContent) return;
    downloadMarkdown(prdContent, productType);
  };

  // Task 3.1 — Export DOCX/PDF/JSON native (lazy-load lib berat di utils/export).
  const handleExportDocx = useCallback(async () => {
    if (!prdContent) return;
    try {
      const { exportDocx } = await import("./utils/export");
      await exportDocx(prdContent, productType, language);
    } catch (e) {
      console.error("DOCX export failed:", e);
      showToast(language === "en" ? "Failed to export DOCX." : "Gagal mengekspor DOCX.");
    }
  }, [prdContent, productType, language, showToast]);

  const handleExportPdf = useCallback(async () => {
    if (!prdContent) return;
    try {
      const { exportPdf } = await import("./utils/export");
      await exportPdf(prdContent, productType, language);
    } catch (e) {
      console.error("PDF export failed:", e);
      showToast(language === "en" ? "Failed to export PDF." : "Gagal mengekspor PDF.");
    }
  }, [prdContent, productType, language, showToast]);

  const handleExportJson = useCallback(async () => {
    if (!prdContent) return;
    try {
      const { exportJson } = await import("./utils/export");
      exportJson(prdContent, productType);
    } catch (e) {
      console.error("JSON export failed:", e);
      showToast(language === "en" ? "Failed to export JSON." : "Gagal mengekspor JSON.");
    }
  }, [prdContent, productType, language, showToast]);

  const handleCopy = async () => {
    if (!prdContent) return;
    try {
      await navigator.clipboard.writeText(prdContent);
      showToast(
        language === "en"
          ? "Copied to clipboard!"
          : "Disalin ke clipboard!"
      );
    } catch {
      showToast(
        language === "en"
          ? "Failed to copy. Please try again."
          : "Gagal menyalin. Coba lagi."
      );
    }
  };

  const handlePrint = () => {
    const element = document.getElementById("prd-print-only");
    if (element) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const html = buildPrintHtml(productType, DOMPurify.sanitize(element.innerHTML));
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        // Wait for styles to apply before printing
        clearTimeout(printTimerRef.current);
        printTimerRef.current = setTimeout(() => {
          printWindow.print();
          // Optional: close after print, but some browsers block the thread so closing right away might cancel print
          // printWindow.close();
        }, 500);
      } else {
        showToast(
          language === "en"
            ? "Pop-up blocked. Please allow pop-ups to print."
            : "Pop-up diblokir. Izinkan pop-up untuk mencetak."
        );
      }
    }
  };

  // === Stable Callback References (P1 — useCallback) ===
  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleSettingsClose = useCallback(() => setIsSettingsOpen(false), []);
  const handleSettingsSave = useCallback((key: string, p: AIProvider, m: string, endpoint?: string) => {
    setCustomApiKey(key);
    persistSettings(p, m, endpoint);
  }, [persistSettings]);
  const handleToggleLanguage = useCallback(() => {
    setLanguage((lang) => {
      const newLang = lang === "id" ? "en" : "id";
      safeSetLocalStorage("PRD_LANGUAGE", newLang);
      return newLang;
    });
  }, []);
  const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const handleSidebarClose = useCallback(() => setSidebarOpen(false), []);
  const handleSidebarSwitchVersion = useCallback((vid: string) => {
    versionSwitchVersion(vid);
  }, [versionSwitchVersion]);
  const handleCommentChange = useCallback((secId: string, comment: string) => {
    versionCommentChange(secId, comment);
  }, [versionCommentChange]);
  const handleClearComments = useCallback(() => setComments({}), [setComments]);
  const handleBlueprintSwitchVersion = useCallback((vid: string) => {
    versionSwitchVersion(vid);
  }, [versionSwitchVersion]);
  const scrollToSectionElement = useCallback((id: string) => {
    const el =
      document.getElementById(`prd-section-${id}`) ??
      document.getElementById(`${id}-heading`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
  const handleSelectSection = useCallback(
    (id: string) => {
      setActiveSectionId(id);
      if (view !== "document") {
        setView("document");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToSectionElement(id);
          });
        });
        return;
      }
      scrollToSectionElement(id);
    },
    [view, scrollToSectionElement],
  );
  const findWbsOutlineItem = useCallback(
    () =>
      outlineItems.find((item) => WBS_SECTION_RE.test(item.title)) ??
      outlineItems[0],
    [outlineItems],
  );
  const handleJumpToWbsChapter = useCallback(() => {
    const target = findWbsOutlineItem();
    if (target) {
      handleSelectSection(target.id);
      return;
    }
    setView("document");
  }, [findWbsOutlineItem, handleSelectSection]);
  const handleAddWbsNote = useCallback(
    (nodeTitle: string) => {
      const target = findWbsOutlineItem();
      if (!target) {
        setView("document");
        return;
      }
      const existing = commentsRef.current[target.id] ?? "";
      const entry = `[WBS: ${nodeTitle}] `;
      const nextComment = existing.trim()
        ? `${existing.trimEnd()}\n${entry}`
        : entry;
      versionCommentChange(target.id, nextComment);
      handleSelectSection(target.id);
    },
    [findWbsOutlineItem, versionCommentChange, handleSelectSection],
  );
  const printTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleQuickPrompt = useCallback((text: string) => {
    setComposerDraft(text);
  }, []);
  const handleAttachClick = useCallback(() => setShowUploader(prev => !prev), []);
  const handleRemoveFile = useCallback((id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);
  const handleScrollTop = useCallback(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const handleScrollBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);
  const showScrollDown = showScrollBottom && isGenerating;
  const handleOpenDiff = useCallback(() => setIsDiffOpen(true), []);
  const handleCloseDiff = useCallback(() => setIsDiffOpen(false), []);

  // Task 3.8 — Extract onSend ke useCallback untuk hindari stale closure
  const handleSend = useCallback((text: string) => {
    setComposerDraft("");
    safeSetLocalStorage(DRAFT_KEY, "");
    if (activeVersionRef.current) {
      handleAppend(text);
    } else {
      handleGenerate(text, "Unknown");
    }
  }, [handleAppend, handleGenerate]);

  return (
    <ErrorBoundary language={language}>
    <div className="h-screen overflow-hidden bg-[var(--oa-bg-canvas)] text-[var(--oa-text-primary)] flex font-sans">
      <Sidebar
        versions={versions}
        activeVersionId={activeVersionId}
        onSwitchVersion={handleSidebarSwitchVersion}
        onNewPRD={handleNewPRD}
        language={language}
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        outlineItems={outlineItems}
        activeSectionId={activeSectionId}
        onSelectSection={handleSelectSection}
        providerLabel={providerLabel}
        modelName={model}
        isGenerating={isGenerating}
        onOpenSettings={handleOpenSettings}
        maxVersions={MAX_PERSISTED_VERSIONS}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          onOpenSettings={handleOpenSettings}
          onExportMd={handleExportMd}
          onExportDocx={handleExportDocx}
          onExportPdf={handleExportPdf}
          onExportJson={handleExportJson}
          onCopy={handleCopy}
          onPrint={handlePrint}
          hasData={prdContent.length > 0}
          language={language}
          onToggleLanguage={handleToggleLanguage}
          theme={theme}
          onToggleTheme={toggleTheme}
          minimal={!hasMessage}
          onToggleSidebar={handleToggleSidebar}
          sidebarOpen={sidebarOpen}
          view={view}
          onViewChange={setView}
          versionsCount={versions.length}
          activeVersionLabel={activeVersionLabel}
          activeMode={activeVersion?.customChapterIds?.length ? "custom" : activeVersion?.prdMode}
          customChapterCount={activeVersion?.customChapterIds?.length}
          onOpenDiff={handleOpenDiff}
          onConvertMode={handleConvertMode}
          isGenerating={isGenerating}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          <LayoutGroup>
            {/* WBS Canvas view — menggantikan BlueprintSheet, lazy-render */}
            {view === "wbs" && hasMessage && prdContent ? (
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center text-[13px] font-mono text-[var(--oa-text-muted)]">
                    {language === "en" ? "Loading WBS canvas..." : "Memuat canvas WBS..."}
                  </div>
                }
              >
                <WbsCanvas
                  content={prdContent}
                  prdMode={activeVersion?.prdMode}
                  language={language}
                  theme={theme}
                  onJumpToDocument={handleJumpToWbsChapter}
                  onAddWbsNote={handleAddWbsNote}
                />
              </Suspense>
            ) : (
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div 
                ref={chatContainerRef}
                className={`flex-1 overflow-y-auto px-4 sm:px-6 ${hasMessage ? "pb-16" : "pb-6"}`}
                id="chat-messages-container"
                aria-busy={isGenerating}
                aria-live="polite"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  onContainerScroll({
                    scrollTop: el.scrollTop,
                    clientHeight: el.clientHeight,
                    scrollHeight: el.scrollHeight,
                  });
                }}
              >
                {!hasMessage ? (
                  <WelcomeScreen 
                    language={language} 
                    onQuickPrompt={handleQuickPrompt} 
                    prdMode={prdMode}
                    onChangeMode={setPrdMode}
                    builderTab={builderTab}
                    onChangeBuilderTab={setBuilderTab}
                    selectedIds={customChapterIds}
                    onChangeSelectedIds={setCustomChapterIds}
                    composer={
                      <ChatInput
                        onSend={handleSend}
                        isGenerating={isGenerating}
                        language={language}
                        onCancel={handleCancel}
                        onAttachClick={handleAttachClick}
                        uploadedFiles={uploadedFiles}
                        onRemoveFile={handleRemoveFile}
                        variant={builderTab === "custom" ? "custom" : "hero"}
                        prdMode={prdMode}
                        onChangeMode={setPrdMode}
                        builderTab={builderTab}
                        onChangeBuilderTab={setBuilderTab}
                        customBlockCount={customChapterIds.length}
                        modelLabel={model}
                        onOpenSettings={handleOpenSettings}
                        draft={composerDraft}
                        onDraftChange={setComposerDraft}
                      />
                    }
                  />
                ) : (
                  <div className="max-w-[820px] mx-auto space-y-6 pt-8 pb-8">
                    {error && (
                      <div
                        role="alert"
                        className="oa-elev-sheet w-full rounded-xl p-4 mb-4 border-[var(--oa-signal-garnet)]/45 bg-[var(--oa-signal-garnet-tint)] text-[var(--oa-signal-garnet)] text-[14px] font-medium no-print flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <AlertCircle size={17} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
                          <span className="leading-snug">{error}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setError(null)}
                          className="shrink-0 p-1 rounded-lg hover:bg-[var(--oa-signal-garnet)]/15 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-signal-garnet)] focus-visible:outline-none"
                          aria-label={language === "en" ? "Dismiss error" : "Tutup pemberitahuan"}
                        >
                          <X size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    {/* Connecting Indicator */}
                    {isConnecting && !prdContent && (
                      <div className="oa-recessed-well flex items-center gap-3 px-4 py-3 mb-4 rounded-xl border border-[var(--oa-border-champagne)]/40">
                        <div className="w-4 h-4 border-2 border-[var(--oa-border-default)] border-t-[var(--oa-accent-champagne)] rounded-full animate-spin shrink-0" />
                        <span className="text-[13px] font-mono text-[var(--oa-text-champagne)]">
                          {language === "en" ? "Connecting to AI..." : "Menghubungkan ke AI..."}
                        </span>
                      </div>
                    )}
                    
                    {/* User Message */}
                    <div className="oa-elev-sheet rounded-2xl p-3.5 sm:p-4 max-w-[95%] sm:max-w-[85%] ml-auto">
                      <p className="text-[14px] text-[var(--oa-text-primary)] whitespace-pre-wrap leading-relaxed">
                        {activeVersion?.userDisplayPrompt || userPrompt}
                      </p>
                    </div>

                    {/* AI Reasoning Panel (model R1/thinking) */}
                    <ReasoningPanel
                      reasoning={activeVersion?.reasoning}
                      isGenerating={isGenerating}
                      language={language}
                    />

                    {/* AI Response — BlueprintSheet */}
                    <BlueprintSheet
                      content={prdContent}
                      comments={comments}
                      onCommentChange={handleCommentChange}
                      versions={versions}
                      activeVersionId={activeVersionId}
                      onSwitchVersion={handleBlueprintSwitchVersion}
                      onRevise={handleRevise}
                      isGenerating={isGenerating}
                      continuingStatus={continuingStatus}
                      truncatedInfo={
                        activeVersionId ? (truncatedByVersion[activeVersionId] ?? null) : null
                      }
                      onContinue={handleContinue}
                      language={language}
                      onConvertMode={handleConvertMode}
                      onCompareVersions={handleOpenDiff}
                      theme={theme}
                    />
                  </div>
                )}
              </div>

              {/* Scroll Controls - anchored above SmartRevisionDock & ChatInput */}
              <AnimatePresence>
                {(showScrollTop || showScrollDown) && (
                  <motion.div
                    key="scroll-controls"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={POPOVER_FADE}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2 pointer-events-none no-print"
                  >
                    {showScrollTop && (
                      <button
                        type="button"
                        onClick={handleScrollTop}
                        className="oa-elev-popover pointer-events-auto min-w-[40px] min-h-[40px] px-3 rounded-full text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:border-[var(--oa-border-strong)] flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                        aria-label={t.scroll.top}
                        title={t.scroll.top}
                      >
                        <ArrowUp size={15} strokeWidth={1.6} aria-hidden="true" />
                      </button>
                    )}
                    {showScrollDown && (
                      <button
                        type="button"
                        onClick={handleScrollBottom}
                        className="oa-elev-popover pointer-events-auto min-h-[40px] px-3.5 rounded-full border-[var(--oa-border-champagne)] text-[var(--oa-text-champagne)] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                        aria-label={t.composer.followLive}
                        title={t.composer.followLive}
                      >
                        <ArrowDown size={14} strokeWidth={1.75} aria-hidden="true" />
                        <span>{t.composer.followLive}</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}

            {/* Floating SmartRevisionDock + Docked bottom Omni-Composer when workspace has active PRD */}
            {hasMessage && view === "document" && (
              <>
                <SmartRevisionDock
                  comments={comments}
                  sections={outlineItems}
                  isGenerating={isGenerating}
                  language={language}
                  onRevise={handleRevise}
                  onClearAll={handleClearComments}
                  onJumpToSection={handleSelectSection}
                />
                <ChatInput
                  onSend={handleSend}
                  isGenerating={isGenerating}
                  language={language}
                  onCancel={handleCancel}
                  onAttachClick={handleAttachClick}
                  uploadedFiles={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                  variant="dock"
                  prdMode={prdMode}
                  onChangeMode={setPrdMode}
                  builderTab={builderTab}
                  onChangeBuilderTab={setBuilderTab}
                  customBlockCount={customChapterIds.length}
                  modelLabel={model}
                  onOpenSettings={handleOpenSettings}
                  draft={composerDraft}
                  onDraftChange={setComposerDraft}
                />
              </>
            )}
          </LayoutGroup>
        </main>
      </div>

      <Suspense fallback={null}>
        <ApiKeyModal
          isOpen={isSettingsOpen}
          onClose={handleSettingsClose}
          onSave={handleSettingsSave}
          language={language}
          initialProvider={provider}
          initialModel={model}
          initialEndpoint={customEndpoint}
        />
      </Suspense>

      {/* Task 3.4 — Diff antar versi */}
      <VersionDiff
        isOpen={isDiffOpen}
        onClose={handleCloseDiff}
        versions={versions}
        activeVersionId={activeVersionId}
        language={language}
      />

      {/* Centered Tier-3 Context Files Overlay */}
      <AnimatePresence>
        {showUploader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={POPOVER_FADE}
            role="dialog"
            aria-modal="true"
            aria-label={language === "en" ? "Context Files" : "File Konteks"}
            onClick={() => setShowUploader(false)}
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-[var(--oa-scrim)] backdrop-blur-xs no-print"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={MODAL_SLIDE_UP}
              onClick={(e) => e.stopPropagation()}
              className="oa-elev-popover w-full max-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl p-5"
            >
              <Suspense
                fallback={
                  <div className="w-full border border-dashed border-[var(--oa-border-default)] rounded-xl py-12 flex items-center justify-center text-[var(--oa-text-muted)] text-[13px] font-mono">
                    {language === "en" ? "Loading uploader..." : "Memuat uploader..."}
                  </div>
                }
              >
                <FileUploader
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  language={language}
                  onClose={() => setShowUploader(false)}
                />
              </Suspense>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] pointer-events-none no-print"
      >
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              key={toastMessage}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={POPOVER_FADE}
              className={`oa-elev-popover rounded-xl px-4 py-2.5 text-[13px] text-[var(--oa-text-primary)] flex items-center gap-2 ${
                /storage full|penyimpanan penuh|failed|gagal|blocked|diblokir/i.test(toastMessage)
                  ? "border-[var(--oa-signal-ochre)]/45"
                  : ""
              }`}
            >
              {/storage full|penyimpanan penuh|failed|gagal|blocked|diblokir/i.test(toastMessage) ? (
                <AlertTriangle
                  size={14}
                  strokeWidth={1.75}
                  className="text-[var(--oa-signal-ochre)] shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Check
                  size={14}
                  strokeWidth={2}
                  className="text-[var(--oa-signal-sage)] shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </ErrorBoundary>
  );
}
