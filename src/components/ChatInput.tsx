import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Loader2, Pause, CornerDownLeft } from "lucide-react";
import { getQuickPrompts } from "../utils/quickPrompts";
import { estimateTokens, formatTokenCount } from "../utils/tokens";
import { safeGetLocalStorage, safeSetLocalStorage } from "../utils/storage";

const DRAFT_KEY = "PRD_DRAFT";

interface ChatInputProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
  language: "en" | "id";
  onCancel?: () => void;
  onAttachClick?: () => void;
  hasFiles?: boolean;
  initialPrompt?: string;
  showQuickPrompts?: boolean;
  fileContextChars?: number;
}

export function ChatInput({
  onSend,
  isGenerating,
  language,
  onCancel,
  onAttachClick,
  hasFiles = false,
  initialPrompt = "",
  showQuickPrompts = false,
  fileContextChars = 0,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState(() => initialPrompt || safeGetLocalStorage(DRAFT_KEY));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const estimatedTokens = estimateTokens(prompt) + Math.ceil(fileContextChars / 4);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (prompt.trim()) {
        safeSetLocalStorage(DRAFT_KEY, prompt);
      } else {
        safeSetLocalStorage(DRAFT_KEY, "");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [prompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onSend(prompt);
    setPrompt("");
    safeSetLocalStorage(DRAFT_KEY, "");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [prompt]);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/95 to-transparent pt-4 pb-3 px-4 z-40">
      <div className="max-w-[720px] mx-auto w-full">
        <form onSubmit={handleSubmit} className="relative w-full">
          <div className="relative flex flex-col w-full bg-[var(--color-surface)] border border-[var(--color-border)] focus-within:border-[var(--color-border-hover)] focus-within:ring-1 focus-within:ring-[var(--color-interactive)]/30 rounded-xl shadow-card transition-all duration-150">
            <textarea
              ref={textareaRef}
              id="prd-prompt-input"
              name="prompt"
              aria-label={language === "en" ? "Product description input" : "Input deskripsi produk"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === "en"
                  ? "Describe product features, user flow, or architectural requirements..."
                  : "Deskripsikan fitur produk, alur pengguna, atau kebutuhan arsitektur..."
              }
              className="w-full bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none resize-none min-h-[46px] max-h-[160px] text-[13px] p-3 pl-3.5 pr-10 leading-relaxed font-sans"
              disabled={isGenerating}
              rows={1}
            />

            {/* Bottom Bar */}
            <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/20 rounded-b-xl">
              <div className="flex items-center gap-2">
                {onAttachClick && (
                  <button
                    type="button"
                    onClick={onAttachClick}
                    aria-label={language === "en" ? "Attach files" : "Lampirkan file"}
                    className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-md transition-colors cursor-pointer ${
                      hasFiles
                        ? "text-[var(--color-interactive)] bg-[var(--color-interactive-subtle)] border border-[var(--color-interactive)]/20 font-medium"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                    }`}
                  >
                    <Paperclip size={12} strokeWidth={1.5} />
                    <span>{hasFiles ? (language === "en" ? "Files" : "File") : (language === "en" ? "Attach" : "Lampirkan")}</span>
                  </button>
                )}

                {estimatedTokens > 0 && (
                  <span className="text-[10.5px] font-mono text-[var(--color-text-muted)]">
                    ~{formatTokenCount(estimatedTokens)} {language === "en" ? "tok" : "tok"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {isGenerating && onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white transition-all text-[11px] font-medium cursor-pointer"
                    aria-label={language === "en" ? "Cancel generation" : "Batalkan"}
                  >
                    <Pause size={11} strokeWidth={1.5} />
                    <span>{language === "en" ? "Stop" : "Batal"}</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!prompt.trim() || isGenerating}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--color-interactive)] hover:bg-[var(--color-interactive-hover)] text-[#080809] text-[11.5px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
                  aria-label={language === "en" ? (isGenerating ? "Generating..." : "Generate PRD") : (isGenerating ? "Menghasilkan..." : "Buat PRD")}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
                      <span>{language === "en" ? "Generating" : "Membuat"}</span>
                    </>
                  ) : (
                    <>
                      <span>{language === "en" ? "Generate" : "Generate"}</span>
                      <CornerDownLeft size={10} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
