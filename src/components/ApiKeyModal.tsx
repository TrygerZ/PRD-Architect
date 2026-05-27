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
    deepseek: ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-pro", "deepseek-v4-flash"],
    claude: ["claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
    gpt: ["gpt-4o", "gpt-4o-mini", "chatgpt-4o-latest", "o1", "o1-mini", "o3-mini"]
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md glass-panel p-6 border border-cyber-accent/30 shadow-2xl shadow-cyber-accent/20 relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-cyber-text-dim hover:text-cyber-accent"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6 border-b border-cyber-border pb-4">
              <Key className="text-cyber-accent" size={24} />
              <h2 className="text-lg font-mono text-cyber-text tracking-wide">
                AI SETTINGS
              </h2>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-mono text-cyber-text-dim mb-2 uppercase">
                {language === "en" ? "AI Provider" : "Penyedia AI"}
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                className="w-full bg-cyber-bg border border-cyber-border p-3 text-cyber-text font-mono text-sm focus:border-cyber-accent focus:outline-none transition-colors appearance-none"
              >
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
                <option value="deepseek">DeepSeek</option>
                <option value="gpt">GPT</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-mono text-cyber-text-dim mb-2 uppercase">
                {language === "en" ? "AI Model" : "Model AI"}
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-cyber-bg border border-cyber-border p-3 text-cyber-text font-mono text-sm focus:border-cyber-accent focus:outline-none transition-colors appearance-none"
              >
                {MODELS[provider].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-mono text-cyber-text-dim mb-2 uppercase">
                {language === "en" ? "Custom API Key (Optional)" : "Custom API Key (Opsional)"}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder="sk-..."
                className="w-full bg-cyber-bg border border-cyber-border p-3 text-cyber-text font-mono text-sm focus:border-cyber-accent focus:outline-none transition-colors"
              />
              <p className="mt-2 text-[10px] text-cyber-text-dim flex items-start gap-1">
                <AlertTriangle
                  size={12}
                  className="shrink-0 mt-0.5 text-amber-500"
                />
                <span>
                  {language === "en"
                    ? "Overrides environment variables. Your key is stored locally in your browser."
                    : "Berlaku untuk provider di atas dan menggantikan environment variable. Disimpan secara lokal di browser Anda."}
                </span>
              </p>
            </div>

            <div className="flex justify-between items-center mt-8">
              <button
                onClick={handleClear}
                className="text-xs font-mono text-cyber-text-dim hover:text-red-400 transition-colors"
                title={language === "en" ? "Clear Key" : "Hapus Key"}
              >
                [ {language === "en" ? "CLEAR" : "HAPUS"} ]
              </button>

              <button
                onClick={handleSave}
                disabled={saved}
                className="cyber-button"
              >
                {saved ? (
                  <>
                    <Check size={16} />{" "}
                    {language === "en" ? "SAVED" : "TERSIPAN"}
                  </>
                ) : language === "en" ? (
                  "UPDATE_KEY"
                ) : (
                  "PERBARUI_KEY"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
