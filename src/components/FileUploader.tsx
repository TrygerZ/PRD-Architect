import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  X,
  FileText,
  Loader2,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UploadedFile } from "../types";

interface FileUploaderProps {
  files: UploadedFile[];
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  language: "id" | "en";
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUploader({
  files,
  onFilesChange,
  language,
}: FileUploaderProps) {
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
    errorTitle: language === "en" ? "Upload Error" : "Kesalahan Unggah",
  };

  const handleFiles = async (selectedFiles: FileList | File[]) => {
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
      // Baca file: binary formats (PDF, DOCX, XLSX, CSV) via server-side parsing,
      // text files (MD, TXT) via FileReader client-side
      const SERVER_SIDE_TYPES = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // XLSX
        'application/vnd.ms-excel',                                                // XLS
        'text/csv',
      ];

      const localResults: UploadedFile[] = [];
      for (const file of validFiles) {
        let content: string;

        const fileNameLower = file.name.toLowerCase();
        const needsServer = SERVER_SIDE_TYPES.includes(file.type)
          || fileNameLower.endsWith('.docx')
          || fileNameLower.endsWith('.xlsx')
          || fileNameLower.endsWith('.xls')
          || fileNameLower.endsWith('.csv');

        if (needsServer) {
          // Upload binary file ke server untuk parsing teks
          const formData = new FormData();
          formData.append('files', file);
          formData.append('language', language);
          try {
            uploadAbortControllerRef.current?.abort();
            const uploadController = new AbortController();
            uploadAbortControllerRef.current = uploadController;
            const response = await fetch('/api/upload-files', {
              method: 'POST',
              body: formData,
              signal: uploadController.signal,
            });
            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error || `Server error ${response.status}`);
            }
            const results = await response.json();
            content = results[0]?.content || `[Error: Tidak ada konten dari ${file.name}]`;
          } catch (uploadErr: unknown) {
            console.error(`Gagal parsing ${file.name}:`, uploadErr);
            const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            content = `[Error parsing ${file.name}: ${msg}]`;
          }
        } else if (file.type.startsWith('image/')) {
          // Image: baca sebagai data URL untuk ditampilkan
          content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(`[Error reading ${file.name}]`);
            reader.readAsDataURL(file);
          });
        } else {
          // Text files (.txt, .md): baca secara client-side dengan FileReader
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
          content: content,
          charCount: content.length,
        });
      }
      onFilesChange(prev => [...prev, ...localResults]);
    } catch (err: unknown) {
      console.error("File Read Error:", err);
      const msg = err instanceof Error ? err.message : "An error occurred while reading files";
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

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
    [files],
  );

  const removeFile = (idToRemove: string) => {
    onFilesChange(prev => prev.filter((f) => f.id !== idToRemove));
  };

  const getFileIcon = (type: string) => {
    if (type.includes("image"))
      return <ImageIcon strokeWidth={1.5} className="w-4 h-4 text-[var(--color-text-secondary)]" />;
    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv")
    )
      return <FileSpreadsheet strokeWidth={1.5} className="w-4 h-4 text-[var(--color-text-secondary)]" />;
    return <FileText strokeWidth={1.5} className="w-4 h-4 text-[var(--color-text-secondary)]" />;
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className={`w-full border border-dashed rounded-md py-8 px-6 flex flex-col items-center justify-center transition-colors cursor-pointer
          ${isDragging ? "border-[var(--color-text-primary)] bg-[var(--color-surface-elevated)]" : "border-[var(--color-border)] hover:border-[var(--color-text-secondary)] bg-transparent"}
          ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
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
            e.target.value = ""; // Reset input
          }}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
            <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1.5} />
            <span className="font-mono text-sm">{t.uploading}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-[var(--color-text-secondary)]">
            <Upload
              strokeWidth={1.5}
              className={`w-6 h-6 mb-2 ${isDragging ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}`}
            />
            <span className="font-medium text-[15px] text-[var(--color-text-secondary)]">{t.dropHere}</span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              {t.supportedFormats}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="w-full p-3 bg-red-900/10 border border-red-500/30 rounded-[6px] flex items-center gap-3 text-red-500 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {files.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AnimatePresence>
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between p-3 rounded-sm bg-[var(--color-surface)] border border-[var(--color-border)] group hover:border-[var(--color-border)] transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {getFileIcon(file.type)}
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-medium text-[var(--color-text-primary)] truncate"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="text-[12px] font-mono text-[var(--color-text-muted)]">
                      {(file.size / 1024).toFixed(1)} KB •{" "}
                      {file.charCount.toLocaleString()} {t.chars}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  aria-label={language === "en" ? "Remove file" : "Hapus file"}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors active:scale-[0.97]"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
