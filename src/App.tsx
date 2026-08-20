import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ChatInput } from "./components/ChatInput";
import { BlueprintSheet } from "./components/BlueprintSheet";
import { ProductType, UploadedFile, AIProvider, PRDMode } from "../shared/types";
import type { PRDVersion } from "./types";
import DOMPurify from "dompurify";
import { ArrowUp, X } from "lucide-react";
import { safeGetLocalStorage, safeSetLocalStorage } from "./utils/storage";
import { buildPrintHtml, downloadMarkdown } from "./utils/printTemplate";
import { useSettings } from "./hooks/useSettings";
import { useToast } from "./hooks/useToast";
import { useScroll } from "./hooks/useScroll";
import { useVersion } from "./hooks/useVersion";
import { useGeneration } from "./hooks/useGeneration";

import { Sidebar } from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ReasoningPanel } from "./components/ReasoningPanel";
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

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const { provider, model, customEndpoint, persistSettings } = useSettings();
  const [productType, setProductType] = useState<ProductType>("Unknown");
  const [language, setLanguage] = useState<"id" | "en">("id");
  const { showScrollTop, handleScroll: onContainerScroll } = useScroll();
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
  } = useVersion();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [prdMode, setPrdMode] = useState<PRDMode>("business");
  const [view, setView] = useState<"document" | "wbs">("document");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef(language);
  const prdModeRef = useRef(prdMode);

  // Ref untuk menghindari stale closure — selalu merefleksikan activeVersion terbaru
  // saat handleAppend / handleRevise dipanggil setelah pergantian versi cepat
  const activeVersionRef = useRef<PRDVersion | undefined>(versions.find((v) => v.id === activeVersionId));
  const commentsRef = useRef(comments);

  // Task 2.3 — Logika generasi dipindah ke hook useGeneration.
  const {
    isGenerating,
    isConnecting,
    error,
    setError,
    abortGeneration,
    handleCancel,
    handleGenerate,
    handleAppend,
    handleRevise,
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
    setProductType,
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
    setCurrentPrompt("");
    setUploadedFiles([]);
  }, [versionNewPRD, abortGeneration, versions.length, language]);

  // showToast now provided by useToast hook

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(quickPromptTimerRef.current);
      clearTimeout(printTimerRef.current);
    };
  }, []);

  // Load preferensi bahasa dari localStorage (default "id")
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
    
    const handlePopState = (e: PopStateEvent) => {
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

  // P6 — popstate guard continued
  // ...

  // Selalu sinkronkan ref dengan activeVersion terbaru (untuk handleAppend/handleRevise)
  useEffect(() => {
    activeVersionRef.current = activeVersion;
    commentsRef.current = comments;
    languageRef.current = language;
    prdModeRef.current = prdMode;
  }, [activeVersion, comments, language, prdMode]);
  const prdContent = activeVersion?.content || "";
  const hasMessage = !!activeVersionId || versions.length > 0;
  const userPrompt = activeVersion?.prompt || "";

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
      await exportDocx(prdContent, productType);
    } catch (e) {
      console.error("DOCX export failed:", e);
      showToast(language === "en" ? "Failed to export DOCX." : "Gagal mengekspor DOCX.");
    }
  }, [prdContent, productType, language, showToast]);

  const handleExportPdf = useCallback(async () => {
    if (!prdContent) return;
    try {
      const { exportPdf } = await import("./utils/export");
      await exportPdf(prdContent, productType);
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
  const handleBlueprintSwitchVersion = useCallback((vid: string) => {
    versionSwitchVersion(vid);
  }, [versionSwitchVersion]);
  const quickPromptTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const printTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleQuickPrompt = useCallback((text: string) => {
    setCurrentPrompt(text);
    clearTimeout(quickPromptTimerRef.current);
    quickPromptTimerRef.current = setTimeout(() => setCurrentPrompt(''), 100);
  }, []);
  const handleAttachClick = useCallback(() => setShowUploader(prev => !prev), []);
  const handleScrollTop = useCallback(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const handleOpenDiff = useCallback(() => setIsDiffOpen(true), []);
  const handleCloseDiff = useCallback(() => setIsDiffOpen(false), []);

  // Task 3.8 — Extract onSend ke useCallback untuk hindari stale closure
  const handleSend = useCallback((text: string) => {
    if (activeVersionRef.current) {
      handleAppend(text);
    } else {
      handleGenerate(text, "Unknown");
    }
  }, [handleAppend, handleGenerate]);

  return (
    <ErrorBoundary language={language}>
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col font-geist">
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
        minimal={!hasMessage}
        onToggleSidebar={handleToggleSidebar}
        view={view}
        onViewChange={setView}
      />

      <div className="flex flex-1 pt-12 min-h-0 max-h-screen">
        {/* Sidebar */}
        <Sidebar
          versions={versions}
          activeVersionId={activeVersionId}
          onSwitchVersion={handleSidebarSwitchVersion}
          onNewPRD={handleNewPRD}
          language={language}
          isOpen={sidebarOpen}
          onClose={handleSidebarClose}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* WBS Canvas view — menggantikan BlueprintSheet, lazy-render */}
          {view === "wbs" && hasMessage && prdContent ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-[13px] font-mono text-[var(--color-text-muted)]">
                  {language === "en" ? "Loading WBS canvas..." : "Memuat canvas WBS..."}
                </div>
              }
            >
              <WbsCanvas
                content={prdContent}
                prdMode={activeVersion?.prdMode}
                language={language}
              />
            </Suspense>
          ) : (
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 sm:px-6 pb-[220px] sm:pb-[180px]" 
            id="chat-messages-container"
            aria-busy={isGenerating}
            aria-live="polite"
            onScroll={(e) => onContainerScroll(e.currentTarget.scrollTop)}
          >
            {showUploader && (
              <div className="max-w-[640px] mx-auto w-full mb-4 mt-4">
                <Suspense
                  fallback={
                    <div className="w-full border border-dashed border-[var(--color-border)] rounded-md py-12 flex items-center justify-center text-[var(--color-text-muted)] text-[13px] font-mono">
                      {language === "en" ? "Loading uploader..." : "Memuat uploader..."}
                    </div>
                  }
                >
                  <FileUploader
                    files={uploadedFiles}
                    onFilesChange={setUploadedFiles}
                    language={language}
                  />
                </Suspense>
              </div>
            )}
            {!hasMessage ? (
              <WelcomeScreen 
                language={language} 
                onQuickPrompt={handleQuickPrompt} 
                prdMode={prdMode}
                onChangeMode={setPrdMode}
              />
            ) : (
              <div className="max-w-[800px] mx-auto space-y-6 pt-8 pb-8">
                {error && (
                  <div role="alert" className="w-full bg-[var(--color-surface)] p-4 mb-4 border border-[var(--color-error)] rounded-md text-[var(--color-error)] text-[15px] font-medium no-print flex items-start justify-between gap-3">
                    <span>{error}</span>
                    <button
                      onClick={() => setError(null)}
                      className="shrink-0 p-1 rounded-sm hover:bg-[var(--color-error-bg)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
                      aria-label={language === "en" ? "Dismiss error" : "Tutup pemberitahuan"}
                    >
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                )}

                {/* Connecting Indicator */}
                {isConnecting && !prdContent && (
                  <div className="flex items-center gap-3 p-4 mb-4 rounded-md border border-[var(--color-interactive-subtle)] bg-[var(--color-interactive-subtle)]">
                    <div className="w-4 h-4 border-2 border-[var(--color-interactive)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[13px] text-[var(--color-interactive)]">
                      {language === "en" ? "Connecting to AI..." : "Menghubungkan ke AI..."}
                    </span>
                  </div>
                )}
                
                {/* User Message */}
                <div className="bg-[var(--color-surface-elevated)] rounded-md p-3 sm:p-4 max-w-[95%] sm:max-w-[85%] ml-auto shadow-sm border border-[var(--color-border)]">
                  <p className="text-[14px] text-[var(--color-text-primary)] whitespace-pre-wrap">
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
                  language={language}
                  onConvertMode={handleConvertMode}
                  onCompareVersions={handleOpenDiff}
                />
              </div>
            )}
          </div>
          )}

          {/* Input — fixed bottom */}
          <ChatInput
            onSend={handleSend}
            isGenerating={isGenerating}
            onCancel={handleCancel}
            language={language}
            onAttachClick={handleAttachClick}
            hasFiles={uploadedFiles.length > 0}
            initialPrompt={currentPrompt}
            showQuickPrompts={false}
            fileContextChars={uploadedFiles.reduce((sum, f) => sum + Math.min(f.charCount ?? 0, 8000), 0)}
          />
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

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={handleScrollTop}
          className={`fixed bottom-[196px] sm:bottom-[156px] right-[16px] sm:right-[40px] z-[35] min-w-[44px] min-h-[44px] rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)] flex items-center justify-center transition-colors duration-200 no-print will-change-transform focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none`}
          aria-label={language === "en" ? "Scroll to top" : "Kembali ke atas"}
          title={language === "en" ? "Scroll to top" : "Kembali ke atas"}
        >
          <ArrowUp size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* Toast Notification */}
      <div 
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] transition-[opacity,transform] duration-300 pointer-events-none no-print
          ${toastMessage ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`
        }
      >
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-[13px] px-4 py-2.5 rounded shadow-xl flex items-center gap-2">
          {toastMessage}
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
