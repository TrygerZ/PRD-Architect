import React, { useState, useRef, useCallback } from "react";
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
  onFilesChange: (files: UploadedFile[]) => void;
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
    const formData = new FormData();
    validFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("/api/upload-files", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload files");
      }

      const uploadedResults: UploadedFile[] = await response.json();
      onFilesChange([...files, ...uploadedResults]);
    } catch (err: any) {
      console.error("Upload Error:", err);
      setError(err.message || "An error occurred during upload");
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
    onFilesChange(files.filter((f) => f.id !== idToRemove));
  };

  const getFileIcon = (type: string) => {
    if (type.includes("image"))
      return <ImageIcon className="w-5 h-5 text-purple-400" />;
    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv")
    )
      return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
    return <FileText className="w-5 h-5 text-cyan-400" />;
  };

  return (
    <div className="w-full flex flex-col gap-4 mb-4">
      <div
        className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors cursor-pointer
          ${isDragging ? "border-cyber-accent bg-cyber-accent/10" : "border-cyber-border/60 hover:border-cyber-accent/50 bg-black/20"}
          ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
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
          <div className="flex flex-col items-center gap-2 text-cyber-accent">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="font-mono text-sm">{t.uploading}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-cyber-text-dim text-center">
            <Upload
              className={`w-8 h-8 mb-2 ${isDragging ? "text-cyber-accent" : "text-cyber-text-dim"}`}
            />
            <span className="font-medium text-cyber-text">{t.dropHere}</span>
            <span className="text-xs font-mono opacity-60">
              {t.supportedFormats}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-400 text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between p-3 rounded-lg bg-cyber-surface/60 border border-cyber-border/40 group hover:border-cyber-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {getFileIcon(file.type)}
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-medium text-cyber-text truncate"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="text-xs font-mono text-cyber-text-dim">
                      {(file.size / 1024).toFixed(1)} KB •{" "}
                      {file.charCount.toLocaleString()} {t.chars}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1.5 rounded-md hover:bg-red-500/20 text-cyber-text-dim hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
