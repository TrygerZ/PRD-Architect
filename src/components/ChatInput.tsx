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
    // Enter = submit, Shift+Enter = newline (berlaku untuk desktop & mobile)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    // Shift+Enter: biarkan default behavior (newline) — tidak perlu handle khusus
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
              className={`absolute left-[10px] top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md transition-opacity duration-200 bg-transparent focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:opacity-80 ${
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
            className="w-full bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none resize-none min-h-[48px] max-h-[200px] font-mono text-[14px] border border-[var(--color-border-subtle)] focus:border-[var(--color-interactive)] rounded-md p-3 pl-12 pr-[88px] transition-[border-color] duration-200"
            disabled={isGenerating}
            rows={1}
          />

          <div className="absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isGenerating && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center justify-center w-[36px] h-[36px] rounded-md border border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white transition-[color,transform,opacity] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97] active:opacity-80"
                aria-label={language === "en" ? "Cancel" : "Batal"}
                title={language === "en" ? "Cancel" : "Batal"}
              >
                <Pause size={16} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="flex items-center justify-center w-[36px] h-[36px] rounded-md bg-[var(--color-text-primary)] text-[var(--color-bg)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-[opacity,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97] active:opacity-80"
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
                  className="flex items-center justify-center gap-1.5 text-[11px] sm:text-[12px] px-3 py-2 min-h-[36px] border border-[var(--color-border)] rounded-sm bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-[color,border-color,transform] duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none active:scale-[0.97]"
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
