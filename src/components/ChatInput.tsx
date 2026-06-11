import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Loader2, Pause } from "lucide-react";
import { getQuickPrompts } from "../utils/quickPrompts";

interface ChatInputProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
  language: "en" | "id";
  onCancel?: () => void;
  onAttachClick?: () => void;
  hasFiles?: boolean;
  initialPrompt?: string;
  showQuickPrompts?: boolean;
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
}: ChatInputProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onSend(prompt);
    setPrompt("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = 'ontouchstart' in window;
    if (isMobile) {
      // Mobile: Enter = newline (no Shift key available)
      return;
    }
    // Desktop: Enter = submit, Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-bg)] border-t border-[var(--color-border)] p-4 z-40">
      <div className="max-w-[800px] mx-auto w-full">
        <form onSubmit={handleSubmit} className="relative w-full mb-3">
          {onAttachClick && (
            <button
              type="button"
              onClick={onAttachClick}
              aria-label={language === "en" ? "Attach files" : "Lampirkan file"}
              className={`absolute left-[10px] top-1/2 -translate-y-1/2 flex items-center justify-center w-[32px] h-[32px] rounded-[8px] transition-all duration-200 bg-transparent focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none ${
                hasFiles ? "text-[var(--color-text-primary)] bg-[var(--color-surface-elevated)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
              }`}
            >
              <Paperclip size={18} strokeWidth={1.5} />
            </button>
          )}

          <textarea
            ref={textareaRef}
            aria-label={language === "en" ? "Product description input" : "Input deskripsi produk"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              language === "en"
                ? "Describe the product you want to build..."
                : "Jelaskan produk yang ingin kamu bangun..."
            }
            className="w-full bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none resize-none min-h-[48px] max-h-[200px] font-mono text-[14px] border border-[#333333] focus:border-[var(--color-interactive)] rounded-[8px] p-3 pl-12 pr-[88px] transition-all duration-200"
            disabled={isGenerating}
            rows={1}
          />

          <div className="absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isGenerating && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center justify-center w-[36px] h-[36px] rounded-[8px] border border-[#8a3a3a] text-[#8a3a3a] hover:bg-[#8a3a3a] hover:text-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
                aria-label={language === "en" ? "Cancel" : "Batal"}
                title={language === "en" ? "Cancel" : "Batal"}
              >
                <Pause size={16} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="flex items-center justify-center w-[36px] h-[36px] rounded-[8px] bg-[var(--color-text-primary)] text-[#111111] hover:bg-[#e5e5e5] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
              aria-label={language === "en" ? (isGenerating ? "Generating" : "Send") : (isGenerating ? "Menghasilkan" : "Kirim")}
              title={language === "en" ? "Generate" : "Buat PRD"}
            >
              {isGenerating ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Send size={16} strokeWidth={1.5} className="relative -ml-[1px]" />
              )}
            </button>
          </div>
        </form>

        {showQuickPrompts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full mt-2">
            {getQuickPrompts(language).map((qp) => {
              const Icon = qp.icon;
              return (
                <button
                  key={qp.id}
                  type="button"
                  onClick={() => setPrompt(qp.text)}
                  className="flex items-center justify-center gap-1.5 text-[11px] sm:text-[12px] px-2 py-1.5 border border-[var(--color-border)] rounded-[6px] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all duration-200 whitespace-nowrap"
                >
                  <Icon size={14} strokeWidth={1.5} />
                  <span>{qp.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
