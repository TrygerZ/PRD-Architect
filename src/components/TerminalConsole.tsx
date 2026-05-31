import { useState, FormEvent, useEffect } from "react";
import { Send, Loader2, Paperclip } from "lucide-react";
import { motion } from "motion/react";
import { ProductType, UploadedFile } from "../types";
import { FileUploader } from "./FileUploader";

interface TerminalConsoleProps {
  onGenerate: (prompt: string, type: ProductType) => void;
  isGenerating: boolean;
  language: "id" | "en";
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}

export function TerminalConsole({
  onGenerate,
  isGenerating,
  language,
  files,
  onFilesChange,
}: TerminalConsoleProps) {
  const [prompt, setPrompt] = useState("");
  const [detectedType, setDetectedType] = useState<ProductType>("Unknown");
  const [showUploader, setShowUploader] = useState(false);

  // Simple heuristic for product type detection
  useEffect(() => {
    const text = prompt.toLowerCase();
    if (
      text.includes("m-commerce") ||
      text.includes("e-commerce") ||
      text.includes("toko") ||
      text.includes("shop") ||
      text.includes("beli") ||
      text.includes("jual") ||
      text.includes("marketplace") ||
      text.includes("commerce") ||
      text.includes("store") ||
      text.includes("kasir") ||
      text.includes("pos")
    ) {
      setDetectedType("e-commerce");
    } else if (
      text.includes("saas") ||
      text.includes("subscription") ||
      text.includes("langganan") ||
      text.includes("dashboard") ||
      text.includes("platform") ||
      text.includes("b2b") ||
      text.includes("layanan") ||
      text.includes("service")
    ) {
      setDetectedType("SaaS");
    } else if (
      text.includes("iot") ||
      text.includes("sensor") ||
      text.includes("device") ||
      text.includes("hardware") ||
      text.includes("alat") ||
      text.includes("mesin") ||
      text.includes("perangkat berat") ||
      text.includes("mikrokontroler") ||
      text.includes("arduino") ||
      text.includes("raspberry pt")
    ) {
      setDetectedType("IoT");
    } else if (
      text.includes("mobile") ||
      text.includes("app") ||
      text.includes("android") ||
      text.includes("ios") ||
      text.includes("aplikasi hw") ||
      text.includes("smartphone") ||
      text.includes("hp")
    ) {
      setDetectedType("Mobile App");
    } else if (
      text.includes("internal") ||
      text.includes("admin") ||
      text.includes("cms") ||
      text.includes("manajemen") ||
      text.includes("erp") ||
      text.includes("sistem informasi") ||
      text.includes("portal") ||
      text.includes("karyawan")
    ) {
      setDetectedType("Internal Tool");
    } else {
      setDetectedType("Unknown");
    }
  }, [prompt]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt, detectedType);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] p-6 mb-8 relative z-10 no-print"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#2a2a2a] pb-4 mb-4 gap-2">
        <h2 className="text-[#f5f5f5] text-[15px] font-semibold font-body">
          {language === "en" ? "Product Description" : "Deskripsi Produk"}
        </h2>
        <div className="flex items-center gap-4 text-[12px] text-[#555555] font-mono">
          <span>Mode: <span className="text-[#999999]">{detectedType}</span></span>
          <span>Chars: <span className="text-[#999999]">{prompt.length}</span></span>
        </div>
      </div>

      {showUploader && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4"
        >
          <FileUploader
            files={files}
            onFilesChange={onFilesChange}
            language={language}
          />
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            language === "en"
              ? "Describe the product you want to build..."
              : "Jelaskan produk yang ingin kamu bangun..."
          }
          className="w-full bg-transparent text-[#f5f5f5] placeholder:text-[#555555] outline-none resize-y min-h-[120px] font-mono text-[13px] border border-[#2a2a2a] focus:border-[#6666ff] rounded-[8px] p-4 transition-all duration-200 ease"
          disabled={isGenerating}
          style={{ paddingBottom: '60px' }}
        />
        
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUploader(!showUploader)}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-[6px] transition-all duration-200 ease border ${
              showUploader || files.length > 0
                ? "bg-[#222222] border-[#2a2a2a] text-[#f5f5f5]"
                : "bg-transparent border-transparent text-[#999999] hover:bg-[#222222] hover:text-[#f5f5f5] hover:border-[#2a2a2a]"
            }`}
          >
            <Paperclip size={16} strokeWidth={1.5} />
            <span className="font-body">{language === "en" ? "Attach File" : "Lampirkan File"}</span>
            {files.length > 0 && (
              <span className="ml-1 bg-[#f5f5f5] text-[#111111] px-1.5 rounded-full text-[11px] font-bold font-mono">
                {files.length}
              </span>
            )}
          </button>
        </div>

        <div className="absolute bottom-3 right-3">
          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-[6px] transition-all duration-200 ease bg-[#f5f5f5] text-[#111111] hover:bg-[#e5e5e5] disabled:opacity-40 disabled:cursor-not-allowed font-body"
          >
            {isGenerating ? (
              <>
                {language === "en" ? "Generating" : "Memproses"} <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              </>
            ) : (
              <>
                {language === "en" ? "Generate" : "Buat PRD"} < Send size={16} strokeWidth={1.5} />
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
