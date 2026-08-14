import { useState, useEffect, useCallback, useRef } from "react";
import { AIProvider } from "../types";
import { PROVIDER_MODELS } from "../../shared/models";
import { safeGetLocalStorage, safeSetLocalStorage } from "../utils/storage";

const VALID_PROVIDERS: AIProvider[] = ["deepseek", "gemini", "opencode", "nine_router"];

export function useSettings() {
  const [provider, setProvider] = useState<AIProvider>("deepseek");
  const [model, setModel] = useState<string>("deepseek-v4-flash");
  const [customEndpoint, setCustomEndpoint] = useState<string>("");
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    const storedProv = safeGetLocalStorage("PRD_AI_PROVIDER") as AIProvider;
    const prov = storedProv && VALID_PROVIDERS.includes(storedProv) ? storedProv : "deepseek";
    setProvider(prov);

    const storedEndpoint = safeGetLocalStorage("PRD_CUSTOM_ENDPOINT") || "";
    setCustomEndpoint(storedEndpoint);

    const storedModel = safeGetLocalStorage("PRD_AI_MODEL");
    const validModels = PROVIDER_MODELS[prov]?.models ?? [];
    if (storedModel && (prov === "nine_router" || validModels.includes(storedModel))) {
      setModel(storedModel);
    } else {
      setModel(PROVIDER_MODELS[prov]?.defaultModel ?? "deepseek-v4-flash");
    }
  }, []);

  const persistSettings = useCallback((p: AIProvider, m: string, endpoint?: string) => {
    setProvider(p);
    setModel(m);
    safeSetLocalStorage("PRD_AI_PROVIDER", p);
    safeSetLocalStorage("PRD_AI_MODEL", m);
    if (endpoint !== undefined) {
      setCustomEndpoint(endpoint);
      safeSetLocalStorage("PRD_CUSTOM_ENDPOINT", endpoint);
    }
  }, []);

  return { provider, model, customEndpoint, persistSettings };
}
