import { useState, useCallback } from "react";
import { AIProvider } from "../types";
import { deriveEndpointLabel } from "../../shared/models";
import { loadSettings, saveSettings, type UnifiedSettings } from "../utils/settings";

const PROVIDER: AIProvider = "openai_compatible";

// Load sinkron (lazy init) agar model/endpoint tidak kosong sesaat saat render pertama.
export function useSettings() {
  const [settings, setSettings] = useState<UnifiedSettings>(loadSettings);

  const persistSettings = useCallback((endpoint: string, model: string, maxTokens: number) => {
    const next: UnifiedSettings = { endpoint, model, maxTokens };
    setSettings(next);
    saveSettings(next);
  }, []);

  return {
    provider: PROVIDER,
    model: settings.model,
    customEndpoint: settings.endpoint,
    maxTokens: settings.maxTokens,
    providerLabel: deriveEndpointLabel(settings.endpoint),
    persistSettings,
  };
}
