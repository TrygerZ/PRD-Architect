import { useState, useEffect, useRef } from "react";
import { Key, X, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { AIProvider } from "../types";
import { MODELS_BY_PROVIDER, PROVIDER_MODELS } from "../../shared/models";
import { safeGetLocalStorage, safeSetLocalStorage } from "../utils/storage";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, provider: AIProvider, model: string, endpoint?: string) => void;
  language: "id" | "en";
  initialProvider?: AIProvider;
  initialModel?: string;
  initialEndpoint?: string;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  onSave,
  language,
  initialProvider = "deepseek",
  initialModel = PROVIDER_MODELS.deepseek.defaultModel,
  initialEndpoint = "",
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [model, setModel] = useState<string>(initialModel);
  const [endpoint, setEndpoint] = useState<string>(initialEndpoint);
  const [saved, setSaved] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const isBackdropMouseDown = useRef(false);

  const MODELS = MODELS_BY_PROVIDER;

  useEffect(() => {
    if (isOpen) {
      const storedProv = safeGetLocalStorage("PRD_AI_PROVIDER") as AIProvider;
      const storedModel = safeGetLocalStorage("PRD_AI_MODEL");
      const storedEndpoint = safeGetLocalStorage("PRD_CUSTOM_ENDPOINT") || "";
      setApiKey("");
      if (storedProv) setProvider(storedProv);
      else setProvider(initialProvider);
      if (storedModel) setModel(storedModel);
      else setModel(initialModel);
      setEndpoint(storedEndpoint || initialEndpoint || PROVIDER_MODELS[storedProv || initialProvider]?.endpoint || "");
      setSaved(false);

      // Auto focus modal container on open
      requestAnimationFrame(() => {
        const firstInput = modalRef.current?.querySelector<HTMLElement>('select, input, button');
        firstInput?.focus();
      });
    }
  }, [isOpen, initialProvider, initialModel, initialEndpoint]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && modalRef.current) {
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setModel(MODELS[newProvider][0]);
    if (newProvider === "nine_router") {
      const storedEndpoint = safeGetLocalStorage("PRD_CUSTOM_ENDPOINT");
      setEndpoint(storedEndpoint || PROVIDER_MODELS.nine_router.endpoint);
    } else {
      setEndpoint(PROVIDER_MODELS[newProvider].endpoint);
    }
  };

  const handleSave = async () => {
    const isNineRouter = provider === "nine_router";
    const finalEndpoint = isNineRouter ? (endpoint.trim() || PROVIDER_MODELS.nine_router.endpoint) : "";

    if (!apiKey.trim()) {
      await handleClear();
      safeSetLocalStorage("PRD_AI_PROVIDER", provider);
      safeSetLocalStorage("PRD_AI_MODEL", model.trim());
      if (isNineRouter) safeSetLocalStorage("PRD_CUSTOM_ENDPOINT", finalEndpoint);
      onSave("", provider, model.trim(), finalEndpoint);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 500);
      return;
    }
    try {
      await fetch("/api/auth/set-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), language }),
      });
      safeSetLocalStorage("PRD_AI_PROVIDER", provider);
      safeSetLocalStorage("PRD_AI_MODEL", model.trim());
      if (isNineRouter) safeSetLocalStorage("PRD_CUSTOM_ENDPOINT", finalEndpoint);
      onSave(apiKey.trim(), provider, model.trim(), finalEndpoint);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Failed to save API key:", err);
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
    onSave("", provider, model.trim(), endpoint.trim());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 print:hidden backdrop-blur-sm"
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => {
            isBackdropMouseDown.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (isBackdropMouseDown.current && e.target === e.currentTarget) {
              onClose();
            }
            isBackdropMouseDown.current = false;
          }}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-settings-title"
            className="w-full max-w-[480px] bg-[var(--color-surface)] p-6 sm:p-7 border border-[var(--color-border)] rounded-2xl shadow-floating relative"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label={language === "en" ? "Close settings" : "Tutup pengaturan"}
              className="absolute top-5 right-5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all p-2 rounded-lg hover:bg-[var(--color-surface-elevated)] cursor-pointer"
            >
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--color-border)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-interactive)]">
                <Key size={15} strokeWidth={1.5} />
              </div>
              <div>
                <h2 id="modal-settings-title" className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                  {language === "en" ? "Studio Settings" : "Pengaturan Studio"}
                </h2>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {language === "en" ? "Configure AI provider and custom access keys" : "Konfigurasi provider AI dan API key"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="ai-provider" className="block text-[12.5px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  {language === "en" ? "AI Provider" : "Penyedia AI"}
                </label>
                <div className="relative">
                  <select
                    id="ai-provider"
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                    className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-text-primary)] text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-colors appearance-none pr-10 cursor-pointer"
                  >
                    <option value="gemini" className="bg-[var(--color-surface-elevated)]">Gemini (Google)</option>
                    <option value="deepseek" className="bg-[var(--color-surface-elevated)]">DeepSeek</option>
                    <option value="opencode" className="bg-[var(--color-surface-elevated)]">OpenCode Zen</option>
                    <option value="nine_router" className="bg-[var(--color-surface-elevated)]">9router (Custom / Proxy)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              {provider === "nine_router" && (
                <div>
                  <label htmlFor="custom-endpoint" className="block text-[12.5px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                    {language === "en" ? "Custom Endpoint URL" : "URL Endpoint Kustom"}
                  </label>
                  <input
                    id="custom-endpoint"
                    type="url"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://api.9router.com/v1/chat/completions"
                    className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-text-primary)] font-mono text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-colors placeholder:text-[var(--color-text-muted)]"
                  />
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    {language === "en" ? "OpenAI-compatible chat completions endpoint" : "Endpoint chat completions standar OpenAI"}
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="ai-model" className="block text-[12.5px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  {language === "en" ? "AI Model" : "Model AI"}
                </label>
                {provider === "nine_router" ? (
                  <div className="space-y-1.5">
                    <input
                      id="ai-model"
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. gpt-4o, claude-3-5-sonnet, deepseek-v3"
                      className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-text-primary)] font-mono text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-colors placeholder:text-[var(--color-text-muted)]"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {MODELS.nine_router.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setModel(m)}
                          className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                            model === m
                              ? "bg-[var(--color-interactive)] text-white border-[var(--color-interactive)]"
                              : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-interactive)]"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      id="ai-model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-text-primary)] text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-colors appearance-none pr-10 cursor-pointer"
                    >
                      {MODELS[provider].map((m) => (
                        <option key={m} value={m} className="bg-[var(--color-surface-elevated)]">
                          {m}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="custom-api-key" className="block text-[12.5px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  {provider === "nine_router"
                    ? (language === "en" ? "API Key" : "API Key 9router")
                    : (language === "en" ? "Custom API Key (Optional)" : "API Key Kustom (Opsional)")}
                </label>
                <input
                  id="custom-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  placeholder={
                    provider === "nine_router"
                      ? (language === "en" ? "Enter your 9router API key..." : "Masukkan API key 9router...")
                      : (language === "en" ? "Leave blank to use system key..." : "Kosongkan untuk pakai key bawaan...")
                  }
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-text-primary)] font-mono text-[13px] focus:border-[var(--color-interactive)] focus:outline-none transition-colors placeholder:text-[var(--color-text-muted)]"
                />
                <div className="mt-2.5 bg-[var(--color-surface-elevated)]/60 border border-[var(--color-border-subtle)] rounded-xl p-2.5 flex gap-2 items-start">
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.5}
                    className="shrink-0 mt-0.5 text-[var(--color-warning)]"
                  />
                  <p className="text-[11.5px] text-[var(--color-text-secondary)] leading-relaxed">
                    {language === "en"
                      ? "Custom key will be securely saved in httpOnly cookie and never exposed to browser scripts."
                      : "Key disimpan di cookie httpOnly terenkripsi dan tidak bisa diakses oleh skrip browser."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={handleClear}
                className="text-[12px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                title={language === "en" ? "Clear Key" : "Hapus Key"}
              >
                {language === "en" ? "Clear Key" : "Hapus Key"}
              </button>

              <button
                onClick={handleSave}
                disabled={saved}
                className="flex items-center gap-1.5 text-[12.5px] font-medium px-4 py-2 rounded-xl transition-all bg-[var(--color-interactive)] hover:bg-[var(--color-interactive-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
              >
                {saved ? (
                  <>
                    <Check size={14} strokeWidth={2} />
                    <span>{language === "en" ? "Saved" : "Tersimpan"}</span>
                  </>
                ) : language === "en" ? (
                  "Save Settings"
                ) : (
                  "Simpan Pengaturan"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
