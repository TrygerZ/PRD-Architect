import { useState, useEffect, useCallback, useRef } from "react";
import { AIProvider } from "../types";
import { safeGetLocalStorage, safeSetLocalStorage } from "../utils/storage";

const VALID_PROVIDERS: AIProvider[] = ["deepseek", "gemini", "opencode"];

export function useSettings() {
  const [provider, setProvider] = useState<AIProvider>("deepseek");
  const [model, setModel] = useState<string>("deepseek-v4-flash");
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    const storedProv = safeGetLocalStorage("PRD_AI_PROVIDER");
    if (storedProv && VALID_PROVIDERS.includes(storedProv as AIProvider)) {
      setProvider(storedProv as AIProvider);
    }
    const storedModel = safeGetLocalStorage("PRD_AI_MODEL");
    if (storedModel) setModel(storedModel);
  }, []);

  const persistSettings = useCallback((p: AIProvider, m: string) => {
    setProvider(p);
    setModel(m);
    safeSetLocalStorage("PRD_AI_PROVIDER", p);
    safeSetLocalStorage("PRD_AI_MODEL", m);
  }, []);

  return { provider, model, persistSettings };
}
