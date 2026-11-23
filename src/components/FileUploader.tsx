import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  X,
  FileText,
  Loader2,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UploadedFile } from "../types";
import { formatTokenCount } from "../utils/tokens";
import { useT } from "../hooks/useT";

export interface FileUploaderProps {
  files: UploadedFile[];
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  language: "id" | "en";
  onClose?: () => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUploader({
  files,
  onFilesChange,
  language,
  onClose,
}: FileUploaderProps) {
  const dict = useT(language);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // P8 — cleanup AbortController on unmount
  useEffect(() => {
    return () => {
      uploadAbortControllerRef.current?.abort();
    };
  }, []);

  const t = {
    title: language === "en" ? "Context Files" : "File Konteks",
    dropHere:
      language === "en"
        ? "Drop files here or click to browse"
        : "Tarik file ke sini atau klik untuk mencari",
    supportedFormats:
      language === "en"
        ? "Supported: PDF, MD, TXT, DOCX, XLSX, CSV, JPG, PNG, GIF, WEBP (Max 10MB)"
        : "Didukung: PDF, MD, TXT, DOCX, XLSX, CSV, JPG, PNG, GIF, WEBP (Max 10MB)",
    maxFiles:
      language === "en"
        ? "Maximum 5 files allowed."
        : "Maksimal 5 file diizinkan.",
    fileTooLarge:
      language === "en"
        ? "File too large. Max 10MB."
        : "Ukuran file terlalu besar. Maks 10MB.",
    uploading: language === "en" ? "Uploading..." : "Mengunggah...",
    chars: language === "en" ? "chars" : "karakter",
  };

  const handleFiles = useCallback(
    async (selectedFiles: FileList | File[]) => {
      setError(null);
      const newFiles = Array.from(selectedFiles);

      if (files.length + newFiles.length > MAX_FILES) {
        setError(t.maxFiles);
        return;
      }

      const validFiles: File[] = [];
      for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`${file.name}: ${t.fileTooLarge}`);
          return;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) return;

      setIsUploading(true);

      try {
        const SERVER_SIDE_TYPES = [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ];

        const localResults: UploadedFile[] = [];
        for (const file of validFiles) {
          let content: string;

          const fileNameLower = file.name.toLowerCase();
          const needsServer =
            SERVER_SIDE_TYPES.includes(file.type) ||
            fileNameLower.endsWith(".docx") ||
            fileNameLower.endsWith(".xlsx") ||
            fileNameLower.endsWith(".xls") ||
            fileNameLower.endsWith(".csv");

          if (needsServer) {
            const formData = new FormData();
            formData.append("files", file);
            formData.append("language", language);
            try {
              uploadAbortControllerRef.current?.abort();
              const uploadController = new AbortController();
              uploadAbortControllerRef.current = uploadController;
              const response = await fetch("/api/upload-files", {
                method: "POST",
                body: formData,
                signal: uploadController.signal,
              });
              if (!response.ok) {
                const errData = (await response.json().catch(() => ({}))) as {
                  error?: string;
                };
                throw new Error(errData.error || `Server error ${response.status}`);
              }
              const results = (await response.json()) as Array<{ content?: string }>;
              content =
                results[0]?.content ||
                `[Error: Tidak ada konten dari ${file.name}]`;
            } catch (uploadErr: unknown) {
              console.error(`Gagal parsing ${file.name}:`, uploadErr);
              const msg =
                uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
              content = `[Error parsing ${file.name}: ${msg}]`;
            }
          } else if (file.type.startsWith("image/")) {
            content = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve(`[Error reading ${file.name}]`);
              reader.readAsDataURL(file);
            });
          } else {
            content = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve(`[Error reading ${file.name}]`);
              reader.readAsText(file);
            });
          }

          localResults.push({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: file.name,
            size: file.size,
            type: file.type,
            content,
            charCount: content.length,
          });
        }
        onFilesChange((prev) => [...prev, ...localResults]);
      } catch (err: unknown) {
        console.error("File Read Error:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "An error occurred while reading files";
        setError(msg);
      } finally {
        setIsUploading(false);
      }
    },
    [files.length, language, onFilesChange, t.fileTooLarge, t.maxFiles],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const removeFile = (idToRemove: string) => {
    onFilesChange((prev) => prev.filter((f) => f.id !== idToRemove));
  };

  const getFileIcon = (type: string) => {
    if (type.includes("image")) {
      return (
        <ImageIcon
          strokeWidth={1.6}
          className="w-4 h-4 text-[var(--oa-text-champagne)] shrink-0"
          aria-hidden="true"
        />
      );
    }
    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv")
    ) {
      return (
        <FileSpreadsheet
          strokeWidth={1.6}
          className="w-4 h-4 text-[var(--oa-signal-sage)] shrink-0"
          aria-hidden="true"
        />
      );
    }
    return (
      <FileText
        strokeWidth={1.6}
        className="w-4 h-4 text-[var(--oa-signal-steel)] shrink-0"
        aria-hidden="true"
      />
    );
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--oa-border-subtle)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="oa-recessed-well w-8 h-8 rounded-xl flex items-center justify-center text-[var(--oa-accent-champagne)] shrink-0">
            <Paperclip size={14} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <h2 className="text-[15px] font-semibold text-[var(--oa-text-primary)] truncate">
            {t.title}
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-[var(--oa-accent-champagne-tint)] border border-[var(--oa-border-champagne)] text-[10.5px] font-mono text-[var(--oa-text-champagne)] shrink-0">
            {files.length} / {MAX_FILES}
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={language === "en" ? "Close context files" : "Tutup file konteks"}
            className="p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
          >
            <X size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Dropzone */}
      <div
        className={`w-full border border-dashed rounded-xl py-7 px-5 flex flex-col items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
          isDragging
            ? "border-[var(--oa-border-champagne)] bg-[var(--oa-accent-champagne-tint)]"
            : "border-[var(--oa-border-default)] bg-[var(--oa-bg-recessed)] hover:border-[var(--oa-border-strong)]"
        } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept=".pdf,.md,.txt,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.gif,.webp"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-[var(--oa-text-secondary)]">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--oa-accent-champagne)]" strokeWidth={1.6} />
            <span className="font-mono text-[12.5px]">{t.uploading}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <Upload
              strokeWidth={1.6}
              className={`w-5 h-5 mb-1 ${
                isDragging
                  ? "text-[var(--oa-accent-champagne)]"
                  : "text-[var(--oa-text-muted)]"
              }`}
              aria-hidden="true"
            />
            <span className="font-medium text-[13.5px] text-[var(--oa-text-primary)]">
              {t.dropHere}
            </span>
            <span className="text-[11px] font-mono text-[var(--oa-text-muted)]">
              {t.supportedFormats}
            </span>
          </div>
        )}
      </div>

      {/* Inline Garnet Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="w-full p-3 rounded-xl border border-[var(--oa-signal-garnet)]/35 bg-[var(--oa-signal-garnet-tint)] flex items-center gap-2.5 text-[var(--oa-signal-garnet)] text-[12.5px]"
          >
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded file list */}
      {files.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <AnimatePresence>
            {files.map((file) => {
              const estTokens = Math.ceil((file.charCount ?? 0) / 4);
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="oa-elev-sheet flex items-center justify-between gap-2 p-2.5 rounded-xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getFileIcon(file.type)}
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-[12.5px] font-medium text-[var(--oa-text-primary)] truncate"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--oa-text-muted)] truncate">
                        {(file.size / 1024).toFixed(1)} KB ·{" "}
                        {file.charCount.toLocaleString()} {t.chars} · ~
                        {formatTokenCount(estTokens)} {dict.composer.tokensSuffix}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    aria-label={
                      language === "en"
                        ? `Remove ${file.name}`
                        : `Hapus ${file.name}`
                    }
                    className="p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-signal-garnet)] hover:bg-[var(--oa-signal-garnet-tint)] transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
