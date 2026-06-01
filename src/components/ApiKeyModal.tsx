import { useState, useEffect } from "react";
import { Key, X, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { AIProvider } from "../types";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, provider: AIProvider, model: string) => void;
  language: "id" | "en";
  initialProvider?: AIProvider;
  initialModel?: string;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  onSave,
  language,
  initialProvider = "deepseek",
  initialModel = "deepseek-chat",
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [model, setModel] = useState<string>(initialModel);
  const [saved, setSaved] = useState(false);

  const MODELS: Record<AIProvider, string[]> = {
    deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro"]
  };

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem("PRD_CUSTOM_API_KEY");
      const storedProv = localStorage.getItem("PRD_AI_PROVIDER") as AIProvider;
      const storedModel = localStorage.getItem("PRD_AI_MODEL");
      if (storedKey) setApiKey(storedKey);
      if (storedProv) setProvider(storedProv);
      else setProvider(initialProvider);
      if (storedModel) setModel(storedModel);
      else setModel(initialModel);
      setSaved(false);
    }
  }, [isOpen, initialProvider, initialModel]);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    // Reset to the default model for the new provider
    setModel(MODELS[newProvider][0]);
  };

  const handleSave = () => {
    localStorage.setItem("PRD_CUSTOM_API_KEY", apiKey.trim());
    localStorage.setItem("PRD_AI_PROVIDER", provider);
    localStorage.setItem("PRD_AI_MODEL", model);
    onSave(apiKey.trim(), provider, model);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleClear = () => {
    localStorage.removeItem("PRD_CUSTOM_API_KEY");
    // We don't remove provider or model, just reset key
    setApiKey("");
    onSave("", provider, model);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/80 p-4 print:hidden backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-[480px] bg-[#1a1a1a] p-8 border border-[#2a2a2a] rounded-[12px] shadow-2xl relative"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-[#555555] hover:text-[#f5f5f5] transition-all duration-200 ease bg-transparent hover:bg-[#222222] p-1.5 rounded-[6px]"
            >
              <X size={20} strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[#2a2a2a]">
              <div className="w-[32px] h-[32px] rounded-[6px] bg-[#222222] border border-[#2a2a2a] flex items-center justify-center">
                <Key className="text-[#999999]" size={16} strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-semibold text-[#f5f5f5]">
                {language === "en" ? "Settings" : "Pengaturan"}
              </h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="ai-provider" className="block text-[13px] font-medium text-[#999999] mb-2">
                  {language === "en" ? "AI Provider" : "Penyedia AI"}
                </label>
                <div className="relative">
                  <select
                    id="ai-provider"
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                    className="w-full bg-[#111111] border border-[#2a2a2a] p-3 rounded-[6px] text-[#f5f5f5] text-[13px] focus:border-[#6666ff] focus:outline-none transition-all duration-200 ease appearance-none pr-10"
                  >
                    <option value="gemini" className="bg-[#111111]">Gemini</option>
                    <option value="deepseek" className="bg-[#111111]">DeepSeek</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#555555]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="ai-model" className="block text-[13px] font-medium text-[#999999] mb-2">
                  {language === "en" ? "AI Model" : "Model AI"}
                </label>
                <div className="relative">
                  <select
                    id="ai-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-[#111111] border border-[#2a2a2a] p-3 rounded-[6px] text-[#f5f5f5] text-[13px] focus:border-[#6666ff] focus:outline-none transition-all duration-200 ease appearance-none pr-10"
                  >
                    {MODELS[provider].map((m) => (
                      <option key={m} value={m} className="bg-[#111111]">
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#555555]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label htmlFor="custom-api-key" className="block text-[13px] font-medium text-[#999999] mb-2">
                  {language === "en" ? "Custom API Key" : "Custom API Key"}
                </label>
                <input
                  id="custom-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  placeholder={language === "en" ? "Optional. Leave blank to use app default..." : "Opsional. Kosongkan untuk bawaan sistem..."}
                  className="w-full bg-[#111111] border border-[#2a2a2a] p-3 rounded-[6px] text-[#f5f5f5] font-mono text-[13px] focus:border-[#6666ff] focus:outline-none transition-all duration-200 ease placeholder:text-[#555555]"
                />
                <div className="mt-3 bg-[#222222] border border-[#2a2a2a] rounded-[6px] p-3 flex gap-2.5 items-start">
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.5}
                    className="shrink-0 mt-0.5 text-[#8a7a2a]"
                  />
                  <p className="text-[12px] text-[#999999] leading-relaxed">
                    {language === "en"
                      ? "Overrides the system default key. Your key is stored securely in your browser's local storage."
                      : "Berlaku untuk provider di atas dan menggantikan key sistem. Tersimpan secara lokal di browser kamu."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-4 border-t border-[#2a2a2a]">
              <button
                onClick={handleClear}
                className="text-[13px] font-medium text-[#555555] hover:text-[#f5f5f5] bg-transparent hover:bg-[#222222] transition-all duration-200 ease px-3 py-1.5 rounded-[6px]"
                title={language === "en" ? "Clear Key" : "Hapus Key"}
              >
                {language === "en" ? "Clear Key" : "Hapus Key"}
              </button>

              <button
                onClick={handleSave}
                disabled={saved}
                className="flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-[6px] transition-all duration-200 ease bg-[#f5f5f5] text-[#111111] hover:bg-[#e5e5e5] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saved ? (
                  <>
                    <Check size={16} strokeWidth={1.5} />{" "}
                    {language === "en" ? "Saved" : "Tersimpan"}
                  </>
                ) : language === "en" ? (
                  "Update Settings"
                ) : (
                  "Perbarui Pengaturan"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
