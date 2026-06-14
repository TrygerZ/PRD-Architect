import { useState, useEffect, useRef } from "react";
import { Key, X, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { AIProvider } from "../types";
import { safeGetLocalStorage, safeSetLocalStorage } from "../utils/storage";

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
  initialModel = "deepseek-v4-flash",
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [model, setModel] = useState<string>(initialModel);
  const [saved, setSaved] = useState(false);

  const firstFocusableRef = useRef<HTMLInputElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      firstFocusableRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstFocusableRef.current) {
        e.preventDefault();
        lastFocusableRef.current?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusableRef.current) {
        e.preventDefault();
        firstFocusableRef.current?.focus();
      }
    }
  };

  const MODELS: Record<AIProvider, string[]> = {
    deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
    opencode: [
      "deepseek-v4-flash-free",
      "nemotron-3-ultra-free",
      "mimo-v2.5-free",
      "north-mini-code-free",
      "big-pickle"
    ]
  };

  useEffect(() => {
    if (isOpen) {
      // API key disimpan di httpOnly cookie (tidak bisa dibaca JS) — tidak dibaca dari localStorage
      const storedProv = safeGetLocalStorage("PRD_AI_PROVIDER") as AIProvider;
      const storedModel = safeGetLocalStorage("PRD_AI_MODEL");
      setApiKey(""); // always start empty — key is in httpOnly cookie
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

  const handleSave = async () => {
    if (!apiKey.trim()) {
      // If empty, just clear the key
      await handleClear();
      onSave("", provider, model);
      return;
    }
    try {
      await fetch("/api/auth/set-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), language }),
      });
      // Provider & model tetap di localStorage (bukan secret)
      safeSetLocalStorage("PRD_AI_PROVIDER", provider);
      safeSetLocalStorage("PRD_AI_MODEL", model);
      onSave(apiKey.trim(), provider, model);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Failed to save API key:", err);
      // Fallback: jika fetch gagal (misal offline), jangan close modal
      alert(language === "en" 
        ? "Failed to save API key. Please check your connection." 
        : "Gagal menyimpan API key. Periksa koneksi Anda.");
    }
  };

  const handleClear = async () => {
    try {
      await fetch("/api/auth/clear-key", { method: "POST" });
    } catch (err) {
      console.error("Failed to clear API key:", err);
    }
    setApiKey("");
    onSave("", provider, model);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-bg)]/80 p-4 print:hidden backdrop-blur-sm" onKeyDown={handleKeyDown} onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-[480px] bg-[var(--color-surface)] p-8 border border-[var(--color-border)] rounded-md shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onClose}              aria-label={language === "en" ? "Close settings" : "Tutup pengaturan"}              className="absolute top-6 right-6 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-[color,transform] duration-200 ease bg-transparent hover:bg-[var(--color-surface-elevated)] p-2 rounded-sm active:scale-[0.97]"
            >
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--color-border)]">
              <div className="w-[32px] h-[32px] rounded-sm bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center">
                <Key className="text-[var(--color-text-secondary)]" size={16} strokeWidth={1.5} />
              </div>
              <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">
                {language === "en" ? "Settings" : "Pengaturan"}
              </h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="ai-provider" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2">
                  {language === "en" ? "AI Provider" : "Penyedia AI"}
                </label>
                <div className="relative">
                  <select
                    id="ai-provider"
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] p-3 rounded-sm text-[var(--color-text-primary)] text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-[border-color] duration-200 ease appearance-none pr-10"
                  >
                    <option value="gemini" className="bg-[var(--color-bg)]">Gemini</option>
                    <option value="deepseek" className="bg-[var(--color-bg)]">DeepSeek</option>
                    <option value="opencode" className="bg-[var(--color-bg)]">OpenCode Zen</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="ai-model" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2">
                  {language === "en" ? "AI Model" : "Model AI"}
                </label>
                <div className="relative">
                  <select
                    id="ai-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] p-3 rounded-sm text-[var(--color-text-primary)] text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-[border-color] duration-200 ease appearance-none pr-10"
                  >
                    {MODELS[provider].map((m) => (
                      <option key={m} value={m} className="bg-[var(--color-bg)]">
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label htmlFor="custom-api-key" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2">
                  {language === "en" ? "Custom API Key" : "API Key Kustom"}
                </label>
                <input
                  ref={firstFocusableRef}
                  id="custom-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  placeholder={language === "en" ? "Optional. Leave blank to use app default..." : "Opsional. Kosongkan untuk bawaan sistem..."}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] p-3 rounded-sm text-[var(--color-text-primary)] font-mono text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-[border-color] duration-200 ease placeholder:text-[var(--color-text-muted)]"
                />
                <div className="mt-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-sm p-3 flex gap-2.5 items-start">
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.5}
                    className="shrink-0 mt-0.5 text-[var(--color-warning)]"
                  />
                  <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    {language === "en"
                      ? "Overrides the system default key. Your key is stored in a secure httpOnly cookie (inaccessible to JavaScript)."
                      : "Berlaku untuk provider di atas dan menggantikan key sistem. Key Anda disimpan di cookie httpOnly yang aman (tidak bisa diakses JavaScript)."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={handleClear}
                className="text-[13px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-transparent hover:bg-[var(--color-surface-elevated)] transition-[color] duration-200 ease px-3 py-2 rounded-sm active:opacity-70"
                title={language === "en" ? "Clear Key" : "Hapus Key"}
              >
                {language === "en" ? "Clear Key" : "Hapus Key"}
              </button>

              <button
                ref={lastFocusableRef}
                onClick={handleSave}
                disabled={saved}
                className="flex items-center gap-2 text-[13px] font-medium px-4 py-2 min-h-[36px] rounded-sm transition-[color,transform,opacity] duration-200 ease bg-[var(--color-text-primary)] text-[var(--color-bg)] hover:bg-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] active:opacity-80"
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
