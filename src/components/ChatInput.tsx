import { useRef, useEffect } from "react";
import {
  Paperclip,
  Loader2,
  Square,
  CornerDownLeft,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
} from "lucide-react";
import { motion } from "motion/react";
import type { PRDMode, UploadedFile } from "../types";
import { estimateTokens, formatTokenCount } from "../utils/tokens";
import { SPRING_SLIDE } from "../utils/motion";
import { useT } from "../hooks/useT";

export interface ChatInputProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
  language: "en" | "id";
  onCancel?: () => void;
  onAttachClick?: () => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (id: string) => void;
  variant: "hero" | "custom" | "dock";
  prdMode: PRDMode;
  onChangeMode: (mode: PRDMode) => void;
  builderTab: "standard" | "custom";
  onChangeBuilderTab: (tab: "standard" | "custom") => void;
  customBlockCount: number;
  modelLabel: string;
  onOpenSettings: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
}

const MODE_DOT_CLASSES: Record<PRDMode | "custom", string> = {
  business: "bg-[var(--oa-signal-ochre)]",
  simple: "bg-[var(--oa-signal-sage)]",
  technical: "bg-[var(--oa-signal-steel)]",
  custom: "bg-[var(--oa-accent-champagne)]",
};

function renderFileIcon(type: string) {
  if (type.includes("image")) {
    return (
      <ImageIcon
        size={12}
        strokeWidth={1.5}
        className="text-[var(--oa-text-champagne)] shrink-0"
        aria-hidden="true"
      />
    );
  }
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) {
    return (
      <FileSpreadsheet
        size={12}
        strokeWidth={1.5}
        className="text-[var(--oa-signal-sage)] shrink-0"
        aria-hidden="true"
      />
    );
  }
  return (
    <FileText
      size={12}
      strokeWidth={1.5}
      className="text-[var(--oa-signal-steel)] shrink-0"
      aria-hidden="true"
    />
  );
}

export function ChatInput({
  onSend,
  isGenerating,
  language,
  onCancel,
  onAttachClick,
  uploadedFiles,
  onRemoveFile,
  variant,
  prdMode,
  onChangeMode,
  builderTab,
  onChangeBuilderTab,
  customBlockCount,
  modelLabel,
  onOpenSettings,
  draft,
  onDraftChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useT(language);

  const fileContextChars = uploadedFiles.reduce(
    (sum, f) => sum + Math.min(f.charCount ?? 0, 8000),
    0,
  );
  const estimatedTokens = estimateTokens(draft) + Math.ceil(fileContextChars / 4);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, variant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isGenerating) return;
    onSend(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const widthClass =
    variant === "custom"
      ? "max-w-[960px] mx-auto w-full"
      : variant === "dock"
        ? "max-w-[820px] mx-auto w-full"
        : "max-w-[780px] mx-auto w-full";

  const modeTabs: Array<{
    key: PRDMode;
    label: string;
    count: string;
    dotClass: string;
  }> = [
    {
      key: "business",
      label: language === "en" ? "Business" : "Bisnis",
      count: "12",
      dotClass: MODE_DOT_CLASSES.business,
    },
    {
      key: "simple",
      label: language === "en" ? "Simple" : "Sederhana",
      count: "6",
      dotClass: MODE_DOT_CLASSES.simple,
    },
    {
      key: "technical",
      label: language === "en" ? "Technical" : "Teknis",
      count: "9",
      dotClass: MODE_DOT_CLASSES.technical,
    },
  ];

  const activeDockLabel =
    builderTab === "custom"
      ? t.builder.tabCustom
      : modeTabs.find((m) => m.key === prdMode)?.label ?? modeTabs[0].label;
  const activeDockDot =
    builderTab === "custom" ? MODE_DOT_CLASSES.custom : MODE_DOT_CLASSES[prdMode];

  const composerCard = (
    <motion.div
      layoutId="omni-composer"
      transition={SPRING_SLIDE}
      className={`${widthClass} oa-elev-composer rounded-2xl focus-within:border-[var(--oa-border-champagne)] transition-colors`}
    >
      <form onSubmit={handleSubmit} className="w-full">
        {/* Inline FileChip strip */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5 pb-1 border-b border-[var(--oa-border-subtle)]">
            {uploadedFiles.map((file) => {
              const fileTokens = Math.ceil((file.charCount ?? 0) / 4);
              return (
                <div
                  key={file.id}
                  className="inline-flex items-center gap-1.5 max-w-[230px] pl-2 pr-1 py-1 rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[11px]"
                >
                  {renderFileIcon(file.type)}
                  <span
                    className="text-[var(--oa-text-primary)] font-medium truncate"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--oa-text-muted)] shrink-0">
                    ~{formatTokenCount(fileTokens)} {t.composer.tokensSuffix}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(file.id)}
                    aria-label={
                      language === "en"
                        ? `Remove ${file.name}`
                        : `Hapus ${file.name}`
                    }
                    className="p-0.5 rounded-md text-[var(--oa-text-muted)] hover:text-[var(--oa-signal-garnet)] hover:bg-[var(--oa-signal-garnet-tint)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  >
                    <X size={11} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              );
            })}

            {onAttachClick && (
              <button
                type="button"
                onClick={onAttachClick}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--oa-accent-champagne-tint)] border border-[var(--oa-border-champagne)] text-[10.5px] font-mono text-[var(--oa-text-champagne)] hover:opacity-90 transition-opacity cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                <span>
                  +{" "}
                  {t.composer.filesCount
                    .replace("{count}", String(uploadedFiles.length))
                    .replace("{max}", "5")}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Prompt Textarea */}
        <textarea
          ref={textareaRef}
          id="prd-prompt-input"
          name="prompt"
          aria-label={
            language === "en" ? "Product description input" : "Input deskripsi produk"
          }
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.composer.placeholder}
          className={`w-full bg-transparent text-[var(--oa-text-primary)] placeholder:text-[var(--oa-text-muted)] outline-none resize-none max-h-[160px] text-[13.5px] px-3.5 py-3 leading-relaxed font-sans ${
            variant === "hero" ? "min-h-[64px]" : "min-h-[44px]"
          }`}
          disabled={isGenerating}
          rows={1}
        />

        {/* Bottom Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 border-t border-[var(--oa-border-subtle)] rounded-b-2xl">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {onAttachClick && (
              <button
                type="button"
                onClick={onAttachClick}
                aria-label={t.composer.attachFiles}
                title={t.composer.attachFiles}
                className={`relative inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11.5px] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                  uploadedFiles.length > 0
                    ? "bg-[var(--oa-accent-champagne-tint)] border-[var(--oa-border-champagne)] text-[var(--oa-text-champagne)] font-medium"
                    : "bg-transparent border-transparent text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/50"
                }`}
              >
                <Paperclip size={13} strokeWidth={1.5} aria-hidden="true" />
                {uploadedFiles.length > 0 && (
                  <span className="text-[10.5px] font-mono">
                    {uploadedFiles.length}
                  </span>
                )}
              </button>
            )}

            {variant === "dock" ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[11px] font-mono text-[var(--oa-text-secondary)]">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeDockDot}`}
                  aria-hidden="true"
                />
                <span>{activeDockLabel}</span>
              </span>
            ) : (
              <div
                role="tablist"
                aria-label={t.welcome.modeGroupLabel}
                className="oa-recessed-well flex items-center gap-0.5 p-0.5 rounded-lg flex-wrap sm:flex-nowrap"
              >
                {modeTabs.map((tab) => {
                  const isActive =
                    builderTab === "standard" && prdMode === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        onChangeBuilderTab("standard");
                        onChangeMode(tab.key);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                        isActive
                          ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] border-[var(--oa-border-champagne)]/60 shadow-subtle"
                          : "border-transparent text-[var(--oa-text-muted)] hover:text-[var(--oa-text-secondary)]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.dotClass}`}
                        aria-hidden="true"
                      />
                      <span>{tab.label}</span>
                      <span className="text-[10px] font-mono text-[var(--oa-text-muted)]">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  role="tab"
                  aria-selected={builderTab === "custom"}
                  onClick={() => onChangeBuilderTab("custom")}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                    builderTab === "custom"
                      ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] border-[var(--oa-border-champagne)]/60 shadow-subtle"
                      : "border-transparent text-[var(--oa-text-muted)] hover:text-[var(--oa-text-secondary)]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${MODE_DOT_CLASSES.custom}`}
                    aria-hidden="true"
                  />
                  <span>{t.builder.tabCustom}</span>
                  <span className="text-[10px] font-mono text-[var(--oa-text-muted)]">
                    {customBlockCount > 0 ? `${customBlockCount}/20` : "23"}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {estimatedTokens > 0 && (
              <span className="text-[10.5px] font-mono text-[var(--oa-text-muted)]">
                ~{formatTokenCount(estimatedTokens)} {t.composer.tokensSuffix}
              </span>
            )}

            <button
              type="button"
              onClick={onOpenSettings}
              title={t.header.settings}
              className="hidden sm:inline-flex items-center gap-1.5 max-w-[160px] px-2 py-1 rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] hover:border-[var(--oa-border-default)] text-[11px] font-mono text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--oa-signal-sage)] shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{modelLabel}</span>
            </button>

            {isGenerating && onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--oa-signal-garnet-tint)] border border-[var(--oa-signal-garnet)]/45 text-[var(--oa-signal-garnet)] hover:bg-[var(--oa-signal-garnet)] hover:text-[#F2F3F5] text-[12px] font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-signal-garnet)] focus-visible:outline-none"
                aria-label={t.composer.stopGenerating}
              >
                <Square size={11} strokeWidth={2} className="fill-current" aria-hidden="true" />
                <span>{t.composer.stopGenerating}</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() || isGenerating}
                className="oa-bevel-cta inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                aria-label={
                  isGenerating ? t.composer.generating : t.composer.generate
                }
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={12} strokeWidth={2} className="animate-spin" aria-hidden="true" />
                    <span>{t.composer.generating}</span>
                  </>
                ) : (
                  <>
                    <span>{t.composer.generate}</span>
                    <CornerDownLeft size={11} strokeWidth={2} aria-hidden="true" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </motion.div>
  );

  if (variant === "dock") {
    return (
      <div className="shrink-0 border-t border-[var(--oa-border-subtle)] bg-[var(--oa-bg-canvas)]/92 backdrop-blur-md px-4 py-3 z-30 no-print">
        {composerCard}
      </div>
    );
  }

  return composerCard;
}
