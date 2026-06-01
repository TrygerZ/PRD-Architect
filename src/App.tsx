import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ChatInput } from "./components/ChatInput";
import { BlueprintSheet, getSections } from "./components/BlueprintSheet";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { generatePRD } from "./services/geminiService";
import { ProductType, PRDVersion, UploadedFile, AIProvider } from "./types";
import { ArrowUp } from "lucide-react";
import { FileUploader } from "./components/FileUploader";

import { Sidebar } from "./components/Sidebar";

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [provider, setProvider] = useState<AIProvider>("deepseek");
  const [model, setModel] = useState<string>("deepseek-v4-flash");
  const [isGenerating, setIsGenerating] = useState(false);
  const [productType, setProductType] = useState<ProductType>("Unknown");
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showUploader, setShowUploader] = useState(false);

  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleCancel = () => {
    abortController?.abort();
    setAbortController(null);
    setIsGenerating(false);
  };

  const handleNewPRD = () => {
    setActiveVersionId(null);
    setComments({});
    setCurrentPrompt("");
    setUploadedFiles([]);
    setVersions([]);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    // Load API key from local storage on init
    const stored = localStorage.getItem("PRD_CUSTOM_API_KEY");
    if (stored) {
      setCustomApiKey(stored);
    }
    const storedProv = localStorage.getItem("PRD_AI_PROVIDER") as AIProvider;
    if (storedProv) {
      setProvider(storedProv);
    }
    const storedModel = localStorage.getItem("PRD_AI_MODEL");
    if (storedModel) {
      setModel(storedModel);
    }
    
    // Scroll listener
    const handleScroll = () => {
      const chatContainer = document.getElementById('chat-messages-container');
      if (chatContainer && chatContainer.scrollTop > 500) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    const chatContainer = document.getElementById('chat-messages-container');
    if (chatContainer) {
      chatContainer.addEventListener("scroll", handleScroll);
      return () => chatContainer.removeEventListener("scroll", handleScroll);
    }
  }, [activeVersionId]);

  const activeVersion = versions.find((v) => v.id === activeVersionId);
  const prdContent = activeVersion?.content || "";
  const hasMessage = !!activeVersionId || versions.length > 0;
  const userPrompt = activeVersion?.prompt || "";

  const handleGenerate = async (prompt: string, type: ProductType = "Unknown") => {
    setIsGenerating(true);
    setProductType(type);
    setError(null);
    setComments({}); // reset comments on new base generation

    abortController?.abort();
    const controller = new AbortController();
    setAbortController(controller);

    const newVersionId = Date.now().toString();
    const newVersion: PRDVersion = {
      id: newVersionId,
      timestamp: Date.now(),
      content: "",
      prompt: prompt,
      userDisplayPrompt: prompt,
      productType: type,
      referencedFilesCount: uploadedFiles.length,
    };

    setVersions((prev) => [...prev, newVersion]);
    setActiveVersionId(newVersionId);

    try {
      await generatePRD(
        prompt,
        customApiKey,
        provider,
        model,
        language,
        type,
        uploadedFiles,
        "initial",
        controller.signal,
        (chunk) => {
          setVersions((prev) =>
            prev.map((v) =>
              v.id === newVersionId ? { ...v, content: v.content + chunk } : v,
            ),
          );
        },
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Keep the partially generated output — don't delete it
        setIsGenerating(false);
        return;
      }
      setError(
        err.message ||
          (language === "en"
            ? "An unexpected error occurred during PRD generation."
            : "Terjadi kesalahan tidak terduga saat membuat PRD."),
      );
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAppend = async (newPrompt: string) => {
    if (!activeVersion) {
      handleGenerate(newPrompt, "Unknown");
      return;
    }

    setIsGenerating(true);
    setError(null);

    abortController?.abort();
    const controller = new AbortController();
    setAbortController(controller);

    const appendPrompt = language === "en"
      ? `I have an existing PRD. Please ADD the following to it:\n\n### EXISTING PRD:\n${activeVersion.content}\n\n### ADDITIONAL REQUEST:\n${newPrompt}`
      : `Saya punya PRD yang sudah ada. Tolong TAMBAHKAN berikut:\n\n### PRD SAAT INI:\n${activeVersion.content}\n\n### PERMINTAAN TAMBAHAN:\n${newPrompt}`;

    const newVersionId = Date.now().toString();
    const newVersion: PRDVersion = {
      id: newVersionId, timestamp: Date.now(), content: "",
      prompt: appendPrompt,
      userDisplayPrompt: newPrompt,
      productType: activeVersion.productType,
      referencedFilesCount: uploadedFiles.length,
    };

    setVersions((prev) => [...prev, newVersion]);
    setActiveVersionId(newVersionId);

    try {
      await generatePRD(appendPrompt, customApiKey, provider, model, language,
        activeVersion.productType, uploadedFiles, "append", controller.signal, (chunk) => {
          setVersions((prev) => prev.map((v) =>
            v.id === newVersionId ? { ...v, content: v.content + chunk } : v
          ));
        });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Keep the partially generated output — don't delete it
        setIsGenerating(false);
        return;
      }
      setError(
        err.message ||
          (language === "en"
            ? "An unexpected error occurred while appending."
            : "Terjadi kesalahan saat menambahkan konten."),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevise = async () => {
    if (!activeVersion || Object.keys(comments).length === 0) return;

    setIsGenerating(true);
    setError(null);

    abortController?.abort();
    const controller = new AbortController();
    setAbortController(controller);

    // Build revision prompt
    let revisionPrompt =
      language === "en"
        ? `I want to revise the current PRD based on specific feedback for certain sections.\n\n### Current PRD:\n${activeVersion.content}\n\n### Revisions requested per section:\n`
        : `Saya ingin merevisi PRD saat ini berdasarkan feedback spesifik untuk beberapa bagian.\n\n### PRD Saat Ini:\n${activeVersion.content}\n\n### Permintaan revisi per bagian:\n`;

    Object.entries(comments).forEach(([sectionId, comment]) => {
      let sectionHeading = sectionId;
      const secIdx = parseInt(sectionId.split("_")[1], 10);
      if (!isNaN(secIdx)) {
        const parsedSections = getSections(activeVersion.content);
        if (parsedSections[secIdx] && parsedSections[secIdx].heading) {
          sectionHeading = parsedSections[secIdx].heading
            .substring(0, 60)
            .trim();
        }
      }
      revisionPrompt += `- **${language === "en" ? "Section" : "Bagian"} "${sectionHeading}"**: ${comment}\n`;
    });
    revisionPrompt +=
      language === "en"
        ? `\nApply ONLY the revisions listed above. Keep ALL other sections exactly as they are — do not rewrite them.`
        : `\nTerapkan HANYA revisi yang disebutkan di atas. Biarkan SEMUA bagian lainnya persis seperti aslinya — jangan menulis ulang.`;

    const newVersionId = Date.now().toString();
    const newVersion: PRDVersion = {
      id: newVersionId,
      timestamp: Date.now(),
      content: "",
      prompt: revisionPrompt, // In chat layout we might not want to show this giant prompt
      userDisplayPrompt: language === "en" ? "Revising PRD based on comments..." : "Merevisi PRD berdasarkan komentar...",
      productType: activeVersion.productType,
      referencedFilesCount: uploadedFiles.length,
    };

    setVersions((prev) => [...prev, newVersion]);
    setActiveVersionId(newVersionId);

    try {
      await generatePRD(
        revisionPrompt,
        customApiKey,
        provider,
        model,
        language,
        activeVersion.productType,
        uploadedFiles,
        "revision",
        controller.signal,
        (chunk) => {
          setVersions((prev) =>
            prev.map((v) =>
              v.id === newVersionId ? { ...v, content: v.content + chunk } : v,
            ),
          );
        },
      );
      // Clear comments after successful revision
      setComments({});
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Keep the partially generated output — don't delete it
        setIsGenerating(false);
        return;
      }
      setError(
        err.message ||
          (language === "en"
            ? "An unexpected error occurred during PRD revision."
            : "Terjadi kesalahan tidak terduga saat merevisi PRD."),
      );
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportMd = () => {
    if (!prdContent) return;
    const blob = new Blob([prdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PRD_${productType.replace(" ", "_")}_${new Date().getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!prdContent) return;
    navigator.clipboard.writeText(prdContent);
    showToast(
      language === "en"
        ? "PRD copied to clipboard!"
        : "PRD disalin ke clipboard!"
    );
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
              ${element.innerHTML}
            </body>
          </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        // Wait for styles to apply before printing
        setTimeout(() => {
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

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col font-geist">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportMd={handleExportMd}
        onCopy={handleCopy}
        onPrint={handlePrint}
        hasData={prdContent.length > 0}
        language={language}
        onToggleLanguage={() =>
          setLanguage((lang) => (lang === "id" ? "en" : "id"))
        }
        minimal={!hasMessage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex flex-1 pt-12 min-h-0 max-h-screen">
        {/* Sidebar */}
        <Sidebar
          versions={versions}
          activeVersionId={activeVersionId}
          onSwitchVersion={(vid) => {
            setActiveVersionId(vid);
            setComments({});
          }}
          onNewPRD={handleNewPRD}
          language={language}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-[240px]" id="chat-messages-container">
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
              <WelcomeScreen language={language} onQuickPrompt={(text) => setCurrentPrompt(text)} />
            ) : (
              <div className="max-w-[800px] mx-auto space-y-6 pt-8 pb-8">
                {error && (
                  <div className="w-full bg-[#1a1a1a] p-4 mb-4 border border-[#8a3a3a] rounded-[8px] text-[#8a3a3a] text-[15px] font-medium no-print">
                    {error}
                  </div>
                )}
                
                {/* User Message */}
                <div className="bg-[#222222] rounded-[8px] p-3 sm:p-4 max-w-[95%] sm:max-w-[85%] ml-auto shadow-sm border border-[#2a2a2a]">
                  <p className="text-[14px] text-[#f5f5f5] whitespace-pre-wrap">
                    {activeVersion?.userDisplayPrompt || userPrompt}
                  </p>
                </div>

                {/* AI Response — BlueprintSheet */}
                <BlueprintSheet
                  content={prdContent}
                  comments={comments}
                  onCommentChange={(secId, comment) => {
                    setComments((prev) => {
                      const newCom = { ...prev, [secId]: comment };
                      if (!comment) delete newCom[secId];
                      return newCom;
                    });
                  }}
                  versions={versions}
                  activeVersionId={activeVersionId}
                  onSwitchVersion={(vid) => {
                    setActiveVersionId(vid);
                    setComments({});
                  }}
                  onRevise={handleRevise}
                  isGenerating={isGenerating}
                  language={language}
                />
              </div>
            )}
          </div>

          {/* Input — fixed bottom */}
          <ChatInput
            onSend={(text) => {
              if (activeVersion) {
                handleAppend(text);
              } else {
                handleGenerate(text, "Unknown");
              }
            }}
            isGenerating={isGenerating}
            onCancel={handleCancel}
            language={language}
            onAttachClick={() => setShowUploader(!showUploader)}
            hasFiles={uploadedFiles.length > 0}
            initialPrompt={currentPrompt}
            showQuickPrompts={false}
          />
        </div>
      </div>

      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(key, p, m) => {
          setCustomApiKey(key);
          setProvider(p);
          setModel(m);
        }}
        language={language}
        initialProvider={provider}
        initialModel={model}
      />

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => {
            const container = document.getElementById('chat-messages-container');
            if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`fixed bottom-[160px] right-[40px] z-[45] w-[36px] h-[36px] rounded-full bg-[#222222] border border-[#333333] text-[#999999] hover:bg-[#333333] hover:text-[#f5f5f5] flex items-center justify-center transition-all duration-200 no-print`}
          title={language === "en" ? "Scroll to top" : "Kembali ke atas"}
        >
          <ArrowUp size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* Toast Notification */}
      <div 
        className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none no-print
          ${toastMessage ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`
        }
      >
        <div className="bg-[#222222] border border-[#333333] text-[#f5f5f5] text-[13px] px-4 py-2.5 rounded shadow-xl flex items-center gap-2">
          {toastMessage}
        </div>
      </div>
    </div>
  );
}
