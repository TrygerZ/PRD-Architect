import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ChatInput } from "./components/ChatInput";
import { BlueprintSheet, getSections } from "./components/BlueprintSheet";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { generatePRD } from "./services/geminiService";
import { ProductType, PRDVersion, UploadedFile, AIProvider, PRDMode } from "./types";
import DOMPurify from "dompurify";
import { ArrowUp, X } from "lucide-react";
import { FileUploader } from "./components/FileUploader";
import { safeGetLocalStorage, safeSetLocalStorage } from "./utils/storage";
import { useSettings } from "./hooks/useSettings";
import { useToast } from "./hooks/useToast";
import { useScroll } from "./hooks/useScroll";
import { useVersion } from "./hooks/useVersion";

import { Sidebar } from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const { provider, model, persistSettings } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);
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

  const [error, setError] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);
  const [prdMode, setPrdMode] = useState<PRDMode>("business");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef(comments);
  const languageRef = useRef(language);
  const prdModeRef = useRef(prdMode);

  // Ref untuk menghindari stale closure — selalu merefleksikan activeVersion terbaru
  // saat handleAppend / handleRevise dipanggil setelah pergantian versi cepat
  const activeVersionRef = useRef(versions.find((v) => v.id === activeVersionId));

  const abortGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
  }, []);

  const handleCancel = () => {
    abortGeneration();
  };

  const handleNewPRD = useCallback(() => {
    // Task 3.11 — Confirm dialog jika sudah ada versi
    if (versions.length > 0) {
      const confirmed = window.confirm(
        language === 'en' ? 'Delete all PRD history?' : 'Hapus semua riwayat PRD?'
      );
      if (!confirmed) return;
    }
    versionNewPRD(isGenerating, abortGeneration);
    setCurrentPrompt("");
    setUploadedFiles([]);
  }, [versionNewPRD, isGenerating, abortGeneration, versions.length, language]);

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
    const storedLang = safeGetLocalStorage("PRD_LANGUAGE") as "id" | "en";
    if (storedLang === "id" || storedLang === "en") {
      setLanguage(storedLang);
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
  activeVersionRef.current = activeVersion;
  commentsRef.current = comments;
  languageRef.current = language;
  prdModeRef.current = prdMode;
  const prdContent = activeVersion?.content || "";
  const hasMessage = !!activeVersionId || versions.length > 0;
  const userPrompt = activeVersion?.prompt || "";

  // ============================================================
  // Helper executeGeneration — menghindari duplikasi kode ~70% di
  // handleGenerate, handleAppend, dan handleRevise (BUG L1)
  // ============================================================
  const executeGeneration = useCallback(async (
    finalPrompt: string,
    displayPrompt: string,
    mode: "initial" | "append" | "revision",
    productType: ProductType,
    prdMode: PRDMode,
    onSuccess?: () => void,
  ) => {
    // Task 3.5 — Guard Ghost Version: jika sudah generating, batalkan dan skip buat versi baru
    if (isGeneratingRef.current) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      isGeneratingRef.current = false;
      return;
    }

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setError(null);

    // Batalkan controller sebelumnya jika masih aktif
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const newVersionId = Date.now().toString();
    const newVersion: PRDVersion = {
      id: newVersionId,
      timestamp: Date.now(),
      content: "",
      prompt: finalPrompt,
      userDisplayPrompt: displayPrompt,
      productType,
      referencedFilesCount: uploadedFiles.length,
      prdMode,
    };

    setVersions((prev) => [...prev, newVersion]);
    setActiveVersionId(newVersionId);

    const lang = languageRef.current;

    try {
      await generatePRD(
        finalPrompt,
        customApiKey,
        provider,
        model,
        lang,
        productType,
        uploadedFiles,
        mode,
        prdMode,
        controller.signal,
        (chunk) => {
          setVersions((prev) =>
            prev.map((v) =>
              v.id === newVersionId ? { ...v, content: v.content + chunk } : v,
            ),
          );
        },
      );
      // Jalankan callback setelah sukses (contoh: hapus komentar setelah revisi)
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'This operation was aborted')) {
        // Biarkan output yang sudah ter-generate sebagian — jangan hapus
        return;
      }
      const message = err instanceof Error ? err.message : undefined;
      setError(
        message ||
          (lang === "en"
            ? "An unexpected error occurred during PRD generation."
            : "Terjadi kesalahan tidak terduga saat membuat PRD."),
      );
      console.error(err);
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [customApiKey, provider, model, uploadedFiles]);

  const handleGenerate = useCallback(async (prompt: string, type: ProductType = "Unknown") => {
    setProductType(type);
    setComments({}); // reset komentar saat generate baru
    await executeGeneration(prompt, prompt, "initial", type, prdModeRef.current);
  }, [executeGeneration]);

  const handleAppend = useCallback(async (newPrompt: string) => {
    // Gunakan ref untuk mendapatkan activeVersion terbaru (hindari stale closure)
    const currentActive = activeVersionRef.current;
    const lang = languageRef.current;
    if (!currentActive) {
      setProductType("Unknown");
      setComments({});
      await executeGeneration(newPrompt, newPrompt, "initial", "Unknown", prdModeRef.current);
      return;
    }

    const appendPrompt = lang === "en"
      ? `I have an existing PRD. Please ADD the following to it:\n\n### EXISTING PRD:\n${currentActive.content}\n\n### ADDITIONAL REQUEST:\n${newPrompt}`
      : `Saya punya PRD yang sudah ada. Tolong TAMBAHKAN berikut:\n\n### PRD SAAT INI:\n${currentActive.content}\n\n### PERMINTAAN TAMBAHAN:\n${newPrompt}`;

    await executeGeneration(
      appendPrompt,
      newPrompt,
      "append",
      currentActive.productType,
      currentActive.prdMode || "business",
    );
  }, [executeGeneration]);

  const handleRevise = useCallback(async () => {
    // Gunakan ref untuk mendapatkan activeVersion terbaru (hindari stale closure)
    const currentActive = activeVersionRef.current;
    const currentComments = commentsRef.current;
    const lang = languageRef.current;

    // Task 3.9 — Filter whitespace-only comments sebelum cek
    const hasRealComments = Object.values(currentComments).some(c => c.trim().length > 0);
    if (!currentActive || !hasRealComments) return;

    // Task 3.3 — Hoist getSections() ke luar forEach (parse PRD sekali saja)
    const parsedSections = getSections(currentActive.content);

    // Bangun prompt revisi dari komentar per bagian
    let revisionPrompt =
      lang === "en"
        ? `I want to revise the current PRD based on specific feedback for certain sections.\n\n### Current PRD:\n${currentActive.content}\n\n### Revisions requested per section:\n`
        : `Saya ingin merevisi PRD saat ini berdasarkan feedback spesifik untuk beberapa bagian.\n\n### PRD Saat Ini:\n${currentActive.content}\n\n### Permintaan revisi per bagian:\n`;

    Object.entries(currentComments).forEach(([sectionId, comment]) => {
      let sectionHeading = sectionId;

      // Task 3.2 — Parse index dari segmen terakhir (format: sec_<heading>_<index>)
      const parts = sectionId.split("_");
      const secIdx = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(secIdx)) {
        if (parsedSections[secIdx] && parsedSections[secIdx].heading) {
          sectionHeading = parsedSections[secIdx].heading
            .substring(0, 60)
            .trim();
        }
      }
      revisionPrompt += `- **${lang === "en" ? "Section" : "Bagian"} "${sectionHeading}"**: ${comment}\n`;
    });
    revisionPrompt +=
      lang === "en"
        ? `\nApply ONLY the revisions listed above. Keep ALL other sections exactly as they are — do not rewrite them.`
        : `\nTerapkan HANYA revisi yang disebutkan di atas. Biarkan SEMUA bagian lainnya persis seperti aslinya — jangan menulis ulang.`;

    await executeGeneration(
      revisionPrompt,
      lang === "en" ? "Revising PRD based on comments..." : "Merevisi PRD berdasarkan komentar...",
      "revision",
      currentActive.productType,
      currentActive.prdMode || "business",
      () => setComments({}), // hapus komentar setelah revisi berhasil
    );
  }, [executeGeneration]);

  const handleExportMd = () => {
    if (!prdContent) return;
    const blob = new Blob([prdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PRD_${productType.replace(/ /g, "_")}_${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        const html = `
          <html>
            <head>
              <title>${productType} - PRD</title>
              <style>
                :root {
                  --color-bg: #ffffff;
                  --color-surface: #fafafa;
                  --color-text-primary: #111111;
                  --color-text-secondary: #555555;
                  --color-text-muted: #767676;
                  --color-border: #dddddd;
                }
                body { 
                  font-family: 'Geist Sans', -apple-system, sans-serif; 
                  line-height: 1.6; 
                  color: #333;
                  padding: 40px;
                  max-width: 800px;
                  margin: 0 auto;
                }
                h1 { 
                  font-family: 'Geist Sans', -apple-system, sans-serif; 
                  font-weight: 700; 
                  color: #111; 
                  margin-top: 24px; 
                  margin-bottom: 16px; 
                }
                h2, h3, h4 { color: #111; margin-top: 32px; margin-bottom: 16px; font-weight: 600; }
                p { margin-bottom: 16px; }
                ul, ol { margin-bottom: 16px; padding-left: 24px; }
                li { margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f9f9f9; font-weight: 600; }
                code { 
                  background-color: #f4f4f5; 
                  padding: 2px 6px; 
                  border-radius: 4px; 
                  font-family: 'Geist Mono', ui-monospace, sans-serif;
                  font-size: 0.9em;
                }
                blockquote {
                  border-left: 4px solid #ddd;
                  padding-left: 16px;
                  color: #666;
                  margin-left: 0;
                  margin-right: 0;
                }
                @media print {
                  body { padding: 0; }
                  @page { margin: 2cm; }
                }
              </style>
            </head>
            <body>
              ${DOMPurify.sanitize(element.innerHTML)}
            </body>
          </html>
        `;
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
  const handleSettingsSave = useCallback((key: string, p: AIProvider, m: string) => {
    setCustomApiKey(key);
    persistSettings(p, m);
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
        onCopy={handleCopy}
        onPrint={handlePrint}
        hasData={prdContent.length > 0}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        minimal={!hasMessage}
        onToggleSidebar={handleToggleSidebar}
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

        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 sm:px-6 pb-[280px]" 
            id="chat-messages-container"
            aria-busy={isGenerating}
            aria-live="polite"
            onScroll={(e) => onContainerScroll(e.currentTarget.scrollTop)}
          >
            {showUploader && (
              <div className="max-w-[640px] mx-auto w-full mb-4 mt-4">
                <FileUploader
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  language={language}
                />
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
                
                {/* User Message */}
                <div className="bg-[var(--color-surface-elevated)] rounded-md p-3 sm:p-4 max-w-[95%] sm:max-w-[85%] ml-auto shadow-sm border border-[var(--color-border)]">
                  <p className="text-[14px] text-[var(--color-text-primary)] whitespace-pre-wrap">
                    {activeVersion?.userDisplayPrompt || userPrompt}
                  </p>
                </div>

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
                />
              </div>
            )}
          </div>

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
          />
        </div>
      </div>

      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        onSave={handleSettingsSave}
        language={language}
        initialProvider={provider}
        initialModel={model}
      />

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={handleScrollTop}
          className={`fixed bottom-[60px] right-[40px] z-[45] w-[36px] h-[36px] rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)] flex items-center justify-center transition-colors duration-200 no-print will-change-transform focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none`}
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
