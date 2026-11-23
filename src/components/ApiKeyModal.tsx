import { useState, useEffect, useRef } from "react";
import {
  Key,
  X,
  Check,
  Shield,
  Loader2,
  PlugZap,
  XCircle,
  Eye,
  EyeOff,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { AIProvider } from "../types";
import { MODELS_BY_PROVIDER, PROVIDER_MODELS } from "../../shared/models";
import { safeGetLocalStorage, safeSetLocalStorage } from "../utils/storage";
import { MODAL_SLIDE_UP, POPOVER_FADE } from "../utils/motion";
import { useT } from "../hooks/useT";

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, provider: AIProvider, model: string, endpoint?: string) => void;
  language: "id" | "en";
  initialProvider?: AIProvider;
  initialModel?: string;
  initialEndpoint?: string;
}

const PROVIDER_TILES: Array<{
  id: AIProvider;
  title: string;
  subtitleEn: string;
  subtitleId: string;
}> = [
  {
    id: "deepseek",
    title: "DeepSeek",
    subtitleEn: "Reasoning & Flash",
    subtitleId: "Penalaran & Flash",
  },
  {
    id: "gemini",
    title: "Google Gemini",
    subtitleEn: "2.5 Flash & Pro",
    subtitleId: "2.5 Flash & Pro",
  },
  {
    id: "opencode",
    title: "OpenCode Zen",
    subtitleEn: "Curated free models",
    subtitleId: "Model gratis terkurasi",
  },
  {
    id: "nine_router",
    title: "9Router Proxy",
    subtitleEn: "Custom OpenAI endpoint",
    subtitleId: "Endpoint OpenAI kustom",
  },
];

export function ApiKeyModal({
  isOpen,
  onClose,
  onSave,
  language,
  initialProvider = "deepseek",
  initialModel = PROVIDER_MODELS.deepseek.defaultModel,
  initialEndpoint = "",
}: ApiKeyModalProps) {
  const t = useT(language);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [model, setModel] = useState<string>(initialModel);
  const [endpoint, setEndpoint] = useState<string>(initialEndpoint);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const isBackdropMouseDown = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const MODELS = MODELS_BY_PROVIDER;

  useEffect(() => {
    return () => {
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setShowApiKey(false);
      setSaveError(null);
      return;
    }

    const storedProv = safeGetLocalStorage("PRD_AI_PROVIDER") as AIProvider;
    const validProviders = Object.keys(MODELS_BY_PROVIDER) as AIProvider[];
    const resolvedProvider =
      storedProv && validProviders.includes(storedProv) ? storedProv : initialProvider;

    const storedModel = safeGetLocalStorage("PRD_AI_MODEL");
    const validModels = MODELS_BY_PROVIDER[resolvedProvider] ?? [];
    const resolvedModel =
      storedModel && (resolvedProvider === "nine_router" || validModels.includes(storedModel))
        ? storedModel
        : (PROVIDER_MODELS[resolvedProvider]?.defaultModel ?? initialModel);

    const storedEndpoint = safeGetLocalStorage("PRD_CUSTOM_ENDPOINT") || "";

    setApiKey("");
    setShowApiKey(false);
    setProvider(resolvedProvider);
    setModel(resolvedModel);
    setEndpoint(
      storedEndpoint || initialEndpoint || PROVIDER_MODELS[resolvedProvider]?.endpoint || "",
    );
    setSaved(false);
    setSaveError(null);

    // Auto focus modal container on open
    requestAnimationFrame(() => {
      const firstInput = modalRef.current?.querySelector<HTMLElement>(
        "button, select, input",
      );
      firstInput?.focus();
    });
  }, [isOpen, initialProvider, initialModel, initialEndpoint]);

  // Reset test diagnostics when modal opens or config changes
  useEffect(() => {
    setTestState("idle");
    setTestMessage("");
    setSaveError(null);
  }, [isOpen, provider, model, endpoint, apiKey]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab" && modalRef.current) {
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
    setSaveError(null);
    const isNineRouter = provider === "nine_router";
    const finalEndpoint = isNineRouter
      ? endpoint.trim() || PROVIDER_MODELS.nine_router.endpoint
      : "";

    if (!apiKey.trim()) {
      // Empty field leaves existing httpOnly key untouched (explicit Clear Key removes it).
      safeSetLocalStorage("PRD_AI_PROVIDER", provider);
      safeSetLocalStorage("PRD_AI_MODEL", model.trim());
      if (isNineRouter) safeSetLocalStorage("PRD_CUSTOM_ENDPOINT", finalEndpoint);
      onSave("", provider, model.trim(), finalEndpoint);
      setSaved(true);
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 450);
      return;
    }

    try {
      const res = await fetch("/api/auth/set-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), language }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Server error ${res.status}`);
      }
      safeSetLocalStorage("PRD_AI_PROVIDER", provider);
      safeSetLocalStorage("PRD_AI_MODEL", model.trim());
      if (isNineRouter) safeSetLocalStorage("PRD_CUSTOM_ENDPOINT", finalEndpoint);
      onSave(apiKey.trim(), provider, model.trim(), finalEndpoint);
      setSaved(true);
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 750);
    } catch (err) {
      console.error("Failed to save API key:", err);
      setSaveError(
        err instanceof Error
          ? err.message
          : language === "en"
            ? "Failed to save API key. Please check your connection."
            : "Gagal menyimpan API key. Periksa koneksi Anda.",
      );
    }
  };

  const handleTest = async () => {
    setTestState("testing");
    setTestMessage("");
    setSaveError(null);
    const isNineRouter = provider === "nine_router";
    const finalEndpoint = isNineRouter
      ? endpoint.trim() || PROVIDER_MODELS.nine_router.endpoint
      : "";
    try {
      // Persist newly entered key into httpOnly cookie first so test uses it
      if (apiKey.trim()) {
        const setRes = await fetch("/api/auth/set-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: apiKey.trim(), language }),
        });
        if (!setRes.ok) {
          const errBody = (await setRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || `Server error ${setRes.status}`);
        }
      }
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          customEndpoint: finalEndpoint || undefined,
          language,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        model?: string;
        latencyMs?: number;
        error?: string;
      };
      if (data?.ok) {
        setTestState("success");
        setTestMessage(
          language === "en"
            ? `Connected to ${data.model} (${data.latencyMs}ms)`
            : `Terhubung ke ${data.model} (${data.latencyMs}ms)`,
        );
      } else {
        setTestState("error");
        setTestMessage(
          data?.error || (language === "en" ? "Connection failed." : "Koneksi gagal."),
        );
      }
    } catch (err) {
      setTestState("error");
      setTestMessage(
        err instanceof Error
          ? err.message
          : language === "en"
            ? "Could not reach the server. Check your connection."
            : "Tidak dapat menghubungi server. Periksa koneksi Anda.",
      );
    }
  };

  const handleClear = async () => {
    setSaveError(null);
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={POPOVER_FADE}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--oa-scrim)] backdrop-blur-xs p-4 print:hidden"
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
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={MODAL_SLIDE_UP}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-settings-title"
            className="oa-elev-popover w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 relative"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-[var(--oa-border-subtle)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="oa-recessed-well w-9 h-9 rounded-xl flex items-center justify-center text-[var(--oa-accent-champagne)] shrink-0">
                  <Key size={15} strokeWidth={1.6} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="modal-settings-title"
                    className="text-[15.5px] font-semibold text-[var(--oa-text-primary)] truncate"
                  >
                    {t.settings.title}
                  </h2>
                  <p className="text-[12px] text-[var(--oa-text-muted)] truncate">
                    {t.settings.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={language === "en" ? "Close settings" : "Tutup pengaturan"}
                className="p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                <X size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 2x2 Tactile Provider Tile Grid */}
              <div>
                <span className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] mb-2">
                  {language === "en" ? "AI Provider" : "Penyedia AI"}
                </span>
                <div
                  role="radiogroup"
                  aria-label={language === "en" ? "AI Provider" : "Penyedia AI"}
                  className="grid grid-cols-2 gap-2"
                >
                  {PROVIDER_TILES.map((tile) => {
                    const active = provider === tile.id;
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleProviderChange(tile.id)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                          active
                            ? "bg-[var(--oa-bg-elevated)] border-[var(--oa-border-champagne)] shadow-subtle"
                            : "oa-recessed-well hover:border-[var(--oa-border-default)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[12.5px] font-semibold text-[var(--oa-text-primary)] truncate">
                            {tile.title}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              active
                                ? "bg-[var(--oa-accent-champagne)]"
                                : "bg-[var(--oa-border-strong)]"
                            }`}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="block text-[11px] text-[var(--oa-text-muted)] truncate">
                          {language === "en" ? tile.subtitleEn : tile.subtitleId}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Endpoint (9Router) */}
              {provider === "nine_router" && (
                <div>
                  <label
                    htmlFor="custom-endpoint"
                    className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] mb-1.5"
                  >
                    {language === "en" ? "Custom Endpoint URL" : "URL Endpoint Kustom"}
                  </label>
                  <input
                    id="custom-endpoint"
                    type="url"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://api.9router.com/v1/chat/completions"
                    className="oa-recessed-well w-full px-3 py-2.5 rounded-xl border-[var(--oa-border-default)] focus:border-[var(--oa-border-champagne)] focus:outline-none text-[var(--oa-text-primary)] font-mono text-[12.5px] placeholder:text-[var(--oa-text-muted)] transition-colors"
                  />
                </div>
              )}

              {/* Model Selector */}
              <div>
                <label
                  htmlFor="ai-model"
                  className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] mb-1.5"
                >
                  {language === "en" ? "Model" : "Model"}
                </label>
                {provider === "nine_router" ? (
                  <div className="space-y-2">
                    <input
                      id="ai-model"
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. gpt-4o-mini, claude-3-5-sonnet, deepseek-v3"
                      className="oa-recessed-well w-full px-3 py-2.5 rounded-xl border-[var(--oa-border-default)] focus:border-[var(--oa-border-champagne)] focus:outline-none text-[var(--oa-text-primary)] font-mono text-[12.5px] placeholder:text-[var(--oa-text-muted)] transition-colors"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {(MODELS.nine_router ?? []).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setModel(m)}
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                            model === m
                              ? "bg-[var(--oa-accent-champagne-tint)] text-[var(--oa-text-champagne)] border-[var(--oa-border-champagne)]"
                              : "oa-recessed-well text-[var(--oa-text-secondary)] hover:border-[var(--oa-border-default)]"
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
                      className="oa-recessed-well w-full px-3 py-2.5 pr-9 rounded-xl border-[var(--oa-border-default)] focus:border-[var(--oa-border-champagne)] focus:outline-none text-[var(--oa-text-primary)] font-mono text-[12.5px] transition-colors appearance-none cursor-pointer"
                    >
                      {(MODELS[provider] ?? []).map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)]"
                        >
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.6}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--oa-text-muted)]"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>

              {/* Masked API Key with Eye/EyeOff toggle */}
              <div>
                <label
                  htmlFor="custom-api-key"
                  className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] mb-1.5"
                >
                  {provider === "nine_router"
                    ? language === "en"
                      ? "API Key"
                      : "API Key 9Router"
                    : language === "en"
                      ? "Custom API Key (Optional)"
                      : "API Key Kustom (Opsional)"}
                </label>
                <div className="relative flex items-center">
                  <input
                    id="custom-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                    placeholder={
                      provider === "nine_router"
                        ? language === "en"
                          ? "Enter your 9Router API key..."
                          : "Masukkan API key 9Router..."
                        : language === "en"
                          ? "Leave blank to keep existing or use system key..."
                          : "Kosongkan untuk mempertahankan key..."
                    }
                    className="oa-recessed-well w-full px-3 py-2.5 pr-10 rounded-xl border-[var(--oa-border-default)] focus:border-[var(--oa-border-champagne)] focus:outline-none text-[var(--oa-text-primary)] font-mono text-[12.5px] placeholder:text-[var(--oa-text-muted)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    aria-label={
                      showApiKey
                        ? language === "en"
                          ? "Hide API key"
                          : "Sembunyikan API key"
                        : language === "en"
                          ? "Show API key"
                          : "Tampilkan API key"
                    }
                    className="absolute right-2 p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                  >
                    {showApiKey ? (
                      <EyeOff size={14} strokeWidth={1.6} aria-hidden="true" />
                    ) : (
                      <Eye size={14} strokeWidth={1.6} aria-hidden="true" />
                    )}
                  </button>
                </div>

                {/* Shield httpOnly security callout */}
                <div className="oa-recessed-well mt-2.5 rounded-xl p-2.5 flex gap-2.5 items-start">
                  <Shield
                    size={14}
                    strokeWidth={1.6}
                    className="shrink-0 mt-0.5 text-[var(--oa-signal-sage)]"
                    aria-hidden="true"
                  />
                  <p className="text-[11.5px] text-[var(--oa-text-secondary)] leading-relaxed">
                    {t.settings.httpOnlyNotice}
                  </p>
                </div>
              </div>

              {/* Live Test Connection + Diagnostics */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testState === "testing"}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl transition-colors bg-[var(--oa-bg-elevated)] border border-[var(--oa-border-default)] text-[var(--oa-text-secondary)] hover:border-[var(--oa-border-champagne)] hover:text-[var(--oa-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                >
                  {testState === "testing" ? (
                    <Loader2 size={14} strokeWidth={1.6} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <PlugZap size={14} strokeWidth={1.6} aria-hidden="true" />
                  )}
                  <span>{t.settings.testConnection}</span>
                </button>

                <div role="status" aria-live="polite">
                  {testState !== "idle" && testState !== "testing" && (
                    <div
                      className={`flex gap-2 items-start rounded-xl border px-3 py-2 text-[11.5px] leading-relaxed ${
                        testState === "success"
                          ? "bg-[var(--oa-signal-sage-tint)] border-[var(--oa-signal-sage)]/35 text-[var(--oa-signal-sage)]"
                          : "bg-[var(--oa-signal-garnet-tint)] border-[var(--oa-signal-garnet)]/35 text-[var(--oa-signal-garnet)]"
                      }`}
                    >
                      {testState === "success" ? (
                        <Check size={14} strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <XCircle size={14} strokeWidth={1.6} className="shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <span>{testMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              {saveError && (
                <div
                  role="alert"
                  className="flex gap-2 items-start rounded-xl border border-[var(--oa-signal-garnet)]/35 bg-[var(--oa-signal-garnet-tint)] px-3 py-2 text-[12px] text-[var(--oa-signal-garnet)]"
                >
                  <AlertCircle size={14} strokeWidth={1.6} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap justify-between items-center gap-2 mt-6 pt-4 border-t border-[var(--oa-border-subtle)]">
              <button
                type="button"
                onClick={handleClear}
                className="text-[12px] font-medium text-[var(--oa-text-muted)] hover:text-[var(--oa-signal-garnet)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none rounded-md px-1.5 py-1"
              >
                {t.settings.clearKey}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                >
                  {t.settings.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saved}
                  className="oa-bevel-cta inline-flex items-center gap-1.5 text-[12px] font-semibold px-4 py-1.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                >
                  {saved ? (
                    <>
                      <Check size={13} strokeWidth={2} aria-hidden="true" />
                      <span>{t.settings.saved}</span>
                    </>
                  ) : (
                    <span>{t.settings.save}</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
