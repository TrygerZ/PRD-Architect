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
      return <ImageIcon strokeWidth={1.5} className="w-4 h-4 text-[#999999]" />;
    if (
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv")
    )
      return <FileSpreadsheet strokeWidth={1.5} className="w-4 h-4 text-[#999999]" />;
    return <FileText strokeWidth={1.5} className="w-4 h-4 text-[#999999]" />;
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className={`w-full border border-dashed rounded-[8px] py-8 px-6 flex flex-col items-center justify-center transition-colors cursor-pointer
          ${isDragging ? "border-[#f5f5f5] bg-[#222222]" : "border-[#333333] hover:border-[#666666] bg-transparent"}
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
          <div className="flex flex-col items-center gap-2 text-[#999999]">
            <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1.5} />
            <span className="font-mono text-sm">{t.uploading}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-[#999999]">
            <Upload
              strokeWidth={1.5}
              className={`w-6 h-6 mb-2 ${isDragging ? "text-[#f5f5f5]" : "text-[#555555]"}`}
            />
            <span className="font-medium text-[15px] text-[#999999]">{t.dropHere}</span>
            <span className="text-xs font-mono text-[#555555]">
              {t.supportedFormats}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
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
                className="flex items-center justify-between p-3 rounded-[6px] bg-[#1a1a1a] border border-[#2a2a2a] group hover:border-[#333333] transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {getFileIcon(file.type)}
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-medium text-[#f5f5f5] truncate"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="text-[12px] font-mono text-[#555555]">
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
                  className="p-1.5 rounded-md hover:bg-[#222222] text-[#555555] hover:text-[#ef4444] transition-colors"
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
