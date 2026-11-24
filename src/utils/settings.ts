import { clampMaxTokens, migrateLegacySettings } from "../../shared/models";
import { safeGetLocalStorage, safeSetLocalStorage } from "./storage";

export const SETTINGS_KEYS = {
  provider: "PRD_AI_PROVIDER",
  model: "PRD_AI_MODEL",
  endpoint: "PRD_CUSTOM_ENDPOINT",
  maxTokens: "PRD_MAX_TOKENS",
} as const;

export interface UnifiedSettings {
  endpoint: string;
  model: string;
  maxTokens: number;
}

// Satu provider universal (OpenAI-compatible). Nilai legacy (deepseek/gemini/opencode/nine_router)
// dimigrasi ke endpoint + model, lalu ditulis ulang agar load berikutnya idempoten.
export function saveSettings(settings: UnifiedSettings): void {
  safeSetLocalStorage(SETTINGS_KEYS.provider, "openai_compatible");
  safeSetLocalStorage(SETTINGS_KEYS.endpoint, settings.endpoint);
  safeSetLocalStorage(SETTINGS_KEYS.model, settings.model);
  safeSetLocalStorage(SETTINGS_KEYS.maxTokens, String(clampMaxTokens(settings.maxTokens)));
}

export function loadSettings(): UnifiedSettings {
  const migrated = migrateLegacySettings({
    provider: safeGetLocalStorage(SETTINGS_KEYS.provider) || null,
    model: safeGetLocalStorage(SETTINGS_KEYS.model) || null,
    endpoint: safeGetLocalStorage(SETTINGS_KEYS.endpoint) || null,
    maxTokens: safeGetLocalStorage(SETTINGS_KEYS.maxTokens) || null,
  });
  saveSettings(migrated);
  return migrated;
}
