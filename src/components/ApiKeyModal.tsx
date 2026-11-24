import { useState, useEffect, useRef, useMemo } from "react";
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
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import type { RemoteModelOption } from "../../shared/types";
import {
  DEFAULT_MAX_TOKENS,
  PROVIDER_PRESETS,
  clampMaxTokens,
  normalizeChatEndpoint,
} from "../../shared/models";
import { MODAL_SLIDE_UP, POPOVER_FADE } from "../utils/motion";
import { useT } from "../hooks/useT";

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, endpoint: string, model: string, maxTokens: number) => void;
  language: "id" | "en";
  initialEndpoint?: string;
  initialModel?: string;
  initialMaxTokens?: number;
}

type AsyncState = "idle" | "loading" | "success" | "error";

const TOKEN_PRESETS: Array<{ label: string; value: number }> = [
  { label: "16k", value: 16384 },
  { label: "32k", value: 32768 },
  { label: "64k", value: 65536 },
];

const FIELD_CLASS =
  "oa-recessed-well w-full px-3 py-2.5 rounded-xl border-[var(--oa-border-default)] focus:border-[var(--oa-border-champagne)] focus:outline-none text-[var(--oa-text-primary)] font-mono text-[12.5px] placeholder:text-[var(--oa-text-muted)] transition-colors";
const LABEL_CLASS =
  "block text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]";
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none";
const CHIP_ACTIVE =
  "bg-[var(--oa-accent-champagne-tint)] text-[var(--oa-text-champagne)] border-[var(--oa-border-champagne)]";
const CHIP_IDLE =
  "oa-recessed-well text-[var(--oa-text-secondary)] hover:border-[var(--oa-border-default)]";

export function ApiKeyModal({
  isOpen,
  onClose,
  onSave,
  language,
  initialEndpoint = "",
  initialModel = "",
  initialMaxTokens = DEFAULT_MAX_TOKENS,
}: ApiKeyModalProps) {
  const t = useT(language);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpoint, setEndpoint] = useState(initialEndpoint);
  const [model, setModel] = useState(initialModel);
  const [maxTokens, setMaxTokens] = useState(String(initialMaxTokens));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testState, setTestState] = useState<AsyncState>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [models, setModels] = useState<RemoteModelOption[]>([]);
  const [modelsState, setModelsState] = useState<AsyncState>("idle");
  const [modelsMessage, setModelsMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelFilter, setModelFilter] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const isBackdropMouseDown = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const normalizedEndpoint = useMemo(() => normalizeChatEndpoint(endpoint), [endpoint]);
  const endpointInvalid = endpoint.trim().length > 0 && normalizedEndpoint === null;

  const activePreset = useMemo(() => {
    if (!normalizedEndpoint) return PROVIDER_PRESETS.find((p) => p.id === "custom");
    const match = PROVIDER_PRESETS.find(
      (p) => p.baseUrl && normalizeChatEndpoint(p.baseUrl) === normalizedEndpoint,
    );
    return match ?? PROVIDER_PRESETS.find((p) => p.id === "custom");
  }, [normalizedEndpoint]);

  const filteredModels = useMemo(() => {
    const q = modelFilter.trim().toLowerCase();
    return q ? models.filter((m) => m.id.toLowerCase().includes(q)) : models;
  }, [models, modelFilter]);

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

    setApiKey("");
    setShowApiKey(false);
    setEndpoint(initialEndpoint);
    setModel(initialModel);
    setMaxTokens(String(initialMaxTokens));
    setAdvancedOpen(false);
    setSaved(false);
    setSaveError(null);
    setModels([]);
    setModelsState("idle");
    setModelsMessage("");
    setPickerOpen(false);
    setModelFilter("");

    requestAnimationFrame(() => {
      const firstInput = modalRef.current?.querySelector<HTMLElement>("button, select, input");
      firstInput?.focus();
    });
  }, [isOpen, initialEndpoint, initialModel, initialMaxTokens]);

  // Reset diagnostics saat konfigurasi berubah.
  useEffect(() => {
    setTestState("idle");
    setTestMessage("");
    setSaveError(null);
  }, [isOpen, model, endpoint, apiKey]);

  // Daftar model milik endpoint lama tidak relevan lagi.
  useEffect(() => {
    setModels([]);
    setModelsState("idle");
    setModelsMessage("");
    setPickerOpen(false);
    setModelFilter("");
  }, [endpoint]);

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

  const handlePresetClick = (presetId: string) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setEndpoint(preset.baseUrl);
    if (preset.defaultModel) setModel(preset.defaultModel);
  };

  // Menyimpan key yang baru diketik ke httpOnly cookie sebelum test / fetch / save.
  const persistTypedKey = async () => {
    if (!apiKey.trim()) return;
    const res = await fetch("/api/auth/set-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey.trim(), language }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || `Server error ${res.status}`);
    }
  };

  const validate = (): string | null => {
    if (!endpoint.trim()) return t.settings.endpointRequired;
    if (!normalizedEndpoint) return t.settings.endpointInvalid;
    if (!model.trim()) return t.settings.modelRequired;
    return null;
  };

  const networkErrorMessage = (err: unknown) =>
    err instanceof Error
      ? err.message
      : language === "en"
        ? "Could not reach the server. Check your connection."
        : "Tidak dapat menghubungi server. Periksa koneksi Anda.";

  const handleFetchModels = async () => {
    if (!endpoint.trim()) {
      setModelsState("error");
      setModelsMessage(t.settings.endpointRequired);
      return;
    }
    if (!normalizedEndpoint) {
      setModelsState("error");
      setModelsMessage(t.settings.endpointInvalid);
      return;
    }
    setModelsState("loading");
    setModelsMessage("");
    try {
      await persistTypedKey();
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai_compatible",
          customEndpoint: endpoint.trim(),
          language,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        models?: RemoteModelOption[];
        error?: string;
      };
      if (data?.ok && Array.isArray(data.models)) {
        setModels(data.models);
        setModelsState("success");
        setPickerOpen(data.models.length > 0);
        if (data.models.length === 0) {
          setModelsMessage(t.settings.noModelsMatch);
        }
      } else {
        setModelsState("error");
        setModelsMessage(
          data?.error || (language === "en" ? "Could not load models." : "Gagal memuat model."),
        );
      }
    } catch (err) {
      setModelsState("error");
      setModelsMessage(networkErrorMessage(err));
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    const problem = validate();
    if (problem) {
      setSaveError(problem);
      return;
    }
    const tokens = clampMaxTokens(maxTokens);
    const cleanEndpoint = endpoint.trim();
    const cleanModel = model.trim();

    try {
      await persistTypedKey();
      onSave(apiKey.trim(), cleanEndpoint, cleanModel, tokens);
      setSaved(true);
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, apiKey.trim() ? 750 : 450);
    } catch (err) {
      console.error("Failed to save API key:", err);
      setSaveError(networkErrorMessage(err));
    }
  };

  const handleTest = async () => {
    setSaveError(null);
    const problem = validate();
    if (problem) {
      setTestState("error");
      setTestMessage(problem);
      return;
    }
    setTestState("loading");
    setTestMessage("");
    try {
      await persistTypedKey();
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai_compatible",
          model: model.trim(),
          customEndpoint: endpoint.trim(),
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
          t.settings.connectedTo
            .replace("{model}", String(data.model ?? model.trim()))
            .replace("{ms}", String(data.latencyMs ?? 0)),
        );
      } else {
        setTestState("error");
        setTestMessage(
          data?.error || (language === "en" ? "Connection failed." : "Koneksi gagal."),
        );
      }
    } catch (err) {
      setTestState("error");
      setTestMessage(networkErrorMessage(err));
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
    onSave("", endpoint.trim(), model.trim(), clampMaxTokens(maxTokens));
  };

  const tokensValue = clampMaxTokens(maxTokens);
  const sampleModels = activePreset?.sampleModels ?? [];

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
                className={`p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer shrink-0 ${FOCUS_RING}`}
              >
                <X size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Quick presets */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={LABEL_CLASS}>{t.settings.quickPresets}</span>
                  <span className="text-[10.5px] text-[var(--oa-text-muted)] truncate">
                    {t.settings.presetsHint}
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-label={t.settings.quickPresets}
                  className="flex flex-wrap gap-1.5"
                >
                  {PROVIDER_PRESETS.map((preset) => {
                    const active = activePreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handlePresetClick(preset.id)}
                        className={`inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${FOCUS_RING} ${
                          active ? `${CHIP_ACTIVE} font-semibold` : `${CHIP_IDLE} font-medium`
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            active
                              ? "bg-[var(--oa-accent-champagne)]"
                              : "bg-[var(--oa-text-muted)]"
                          }`}
                          aria-hidden="true"
                        />
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label htmlFor="custom-endpoint" className={`${LABEL_CLASS} mb-1.5`}>
                  {t.settings.baseUrlLabel}
                </label>
                <input
                  id="custom-endpoint"
                  type="url"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  spellCheck={false}
                  aria-invalid={endpointInvalid}
                  className={FIELD_CLASS}
                />
                {endpointInvalid ? (
                  <p className="mt-1.5 text-[10.5px] text-[var(--oa-signal-garnet)]">
                    {t.settings.endpointInvalid}
                  </p>
                ) : (
                  normalizedEndpoint && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-mono text-[var(--oa-text-muted)] min-w-0">
                      <span className="font-bold tracking-wide text-[var(--oa-text-champagne)] shrink-0">
                        {t.settings.resolvedPreview}
                      </span>
                      <span className="truncate">{normalizedEndpoint}</span>
                    </p>
                  )
                )}
              </div>

              {/* Model */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="ai-model" className={LABEL_CLASS}>
                    {t.settings.modelLabel}
                  </label>
                  {modelsState === "success" && models.length > 0 && (
                    <span className="text-[10.5px] font-mono font-medium text-[var(--oa-signal-sage)]">
                      {t.settings.modelsLoaded.replace("{count}", String(models.length))}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="ai-model"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={t.settings.modelPlaceholder}
                    spellCheck={false}
                    autoComplete="off"
                    className={FIELD_CLASS}
                  />
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={modelsState === "loading"}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-2.5 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING} ${
                      modelsState === "success"
                        ? `${CHIP_ACTIVE}`
                        : "bg-[var(--oa-bg-elevated)] border-[var(--oa-border-default)] text-[var(--oa-text-primary)] hover:border-[var(--oa-border-champagne)]"
                    }`}
                  >
                    {modelsState === "loading" ? (
                      <Loader2 size={13} strokeWidth={1.6} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw size={13} strokeWidth={1.6} aria-hidden="true" />
                    )}
                    <span>
                      {modelsState === "loading"
                        ? t.settings.fetchingModels
                        : modelsState === "success"
                          ? t.settings.refreshModels
                          : t.settings.fetchModels}
                    </span>
                  </button>
                </div>

                <div role="status" aria-live="polite">
                  {modelsState === "error" && modelsMessage && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[var(--oa-signal-garnet)]">
                      <XCircle size={12} strokeWidth={1.6} className="shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{modelsMessage}</span>
                    </p>
                  )}
                </div>

                {pickerOpen && models.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-[var(--oa-border-champagne)] bg-[var(--oa-bg-surface)] p-2 space-y-1">
                    <div className="oa-recessed-well flex items-center gap-2 px-2.5 py-1.5 rounded-lg">
                      <Search size={12} strokeWidth={1.6} className="text-[var(--oa-text-muted)] shrink-0" aria-hidden="true" />
                      <input
                        type="text"
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        placeholder={t.settings.filterModelsPlaceholder.replace(
                          "{count}",
                          String(models.length),
                        )}
                        aria-label={t.settings.filterModelsPlaceholder.replace(
                          "{count}",
                          String(models.length),
                        )}
                        className="w-full bg-transparent text-[11.5px] text-[var(--oa-text-primary)] placeholder:text-[var(--oa-text-muted)] focus:outline-none"
                      />
                    </div>
                    <ul role="listbox" aria-label={t.settings.modelLabel} className="max-h-[160px] overflow-y-auto">
                      {filteredModels.length === 0 && (
                        <li className="px-2.5 py-2 text-[11px] text-[var(--oa-text-muted)]">
                          {t.settings.noModelsMatch}
                        </li>
                      )}
                      {filteredModels.map((m) => {
                        const selected = m.id === model.trim();
                        return (
                          <li key={m.id} role="option" aria-selected={selected}>
                            <button
                              type="button"
                              onClick={() => {
                                setModel(m.id);
                                setPickerOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${FOCUS_RING} ${
                                selected
                                  ? "bg-[var(--oa-accent-champagne-tint)] text-[var(--oa-text-champagne)]"
                                  : "text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                {selected && (
                                  <Check size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                                )}
                                <span className="text-[11.5px] font-mono truncate">{m.id}</span>
                              </span>
                              {m.contextLength !== undefined && (
                                <span className="text-[10px] font-mono text-[var(--oa-text-muted)] shrink-0">
                                  {m.contextLength >= 1_000_000
                                    ? `${Math.round(m.contextLength / 1_000_000)}M`
                                    : `${Math.round(m.contextLength / 1000)}k`}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  sampleModels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sampleModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setModel(m)}
                          className={`text-[10.5px] font-mono px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${FOCUS_RING} ${
                            model.trim() === m ? CHIP_ACTIVE : CHIP_IDLE
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* API key */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="custom-api-key" className={LABEL_CLASS}>
                    {t.settings.apiKeyLabel}
                  </label>
                  <span className="text-[10.5px] text-[var(--oa-text-muted)]">
                    {t.settings.apiKeyOptionalHint}
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="custom-api-key"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                    placeholder={t.settings.apiKeyPlaceholder}
                    className={`${FIELD_CLASS} pr-10`}
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
                    className={`absolute right-2 p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer ${FOCUS_RING}`}
                  >
                    {showApiKey ? (
                      <EyeOff size={14} strokeWidth={1.6} aria-hidden="true" />
                    ) : (
                      <Eye size={14} strokeWidth={1.6} aria-hidden="true" />
                    )}
                  </button>
                </div>

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

              {/* Advanced */}
              <div className="oa-recessed-well rounded-xl px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  aria-expanded={advancedOpen}
                  className={`w-full flex items-center justify-between gap-2 rounded-md cursor-pointer ${FOCUS_RING}`}
                >
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--oa-text-secondary)]">
                    {advancedOpen ? (
                      <ChevronDown size={13} strokeWidth={1.6} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={13} strokeWidth={1.6} aria-hidden="true" />
                    )}
                    {t.settings.advancedTitle}
                  </span>
                  <span className="text-[10.5px] font-mono text-[var(--oa-text-muted)]">
                    {t.settings.advancedSummary.replace(
                      "{tokens}",
                      tokensValue.toLocaleString("en-US"),
                    )}
                  </span>
                </button>

                {advancedOpen && (
                  <div className="mt-2.5 space-y-2">
                    <label htmlFor="max-output-tokens" className={LABEL_CLASS}>
                      {t.settings.maxOutputTokens}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="max-output-tokens"
                        type="number"
                        inputMode="numeric"
                        min={1024}
                        max={131072}
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--oa-border-default)] bg-[var(--oa-bg-surface)] text-[var(--oa-text-primary)] font-mono text-[11.5px] focus:border-[var(--oa-border-champagne)] focus:outline-none"
                      />
                      {TOKEN_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setMaxTokens(String(p.value))}
                          className={`shrink-0 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${FOCUS_RING} ${
                            tokensValue === p.value ? `${CHIP_ACTIVE} font-bold` : CHIP_IDLE
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-[var(--oa-text-muted)]">
                      {t.settings.autoContinueHint}
                    </p>
                  </div>
                )}
              </div>

              {/* Connection diagnostics */}
              <div role="status" aria-live="polite">
                {(testState === "success" || testState === "error") && (
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
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testState === "loading"}
                  className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl transition-colors bg-[var(--oa-bg-elevated)] border border-[var(--oa-border-default)] text-[var(--oa-text-secondary)] hover:border-[var(--oa-border-champagne)] hover:text-[var(--oa-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
                >
                  {testState === "loading" ? (
                    <Loader2 size={14} strokeWidth={1.6} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <PlugZap size={14} strokeWidth={1.6} aria-hidden="true" />
                  )}
                  <span>{t.settings.testConnection}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className={`text-[12px] font-medium text-[var(--oa-text-muted)] hover:text-[var(--oa-signal-garnet)] transition-colors cursor-pointer rounded-md px-1.5 py-1 ${FOCUS_RING}`}
                >
                  {t.settings.clearKey}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer ${FOCUS_RING}`}
                >
                  {t.settings.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saved}
                  className={`oa-bevel-cta inline-flex items-center gap-1.5 text-[12px] font-semibold px-4 py-1.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
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
