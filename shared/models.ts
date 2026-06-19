// Katalog model & endpoint terpusat — single source of truth untuk FE & BE.
// FE (ApiKeyModal) membaca `models` + `defaultModel`.
// BE (server.ts) membaca `endpoint`, `defaultModel`, dan `apiKeyEnvName`.
// Endpoint harus konsisten dengan CSP connectSrc di server.ts.

import type { AIProvider } from "./types";

export interface ProviderConfig {
  endpoint: string;
  apiKeyEnvName: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDER_MODELS: Record<AIProvider, ProviderConfig> = {
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    apiKeyEnvName: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKeyEnvName: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  opencode: {
    endpoint: "https://opencode.ai/zen/v1/chat/completions",
    apiKeyEnvName: "OPENCODE_API_KEY",
    defaultModel: "deepseek-v4-flash-free",
    models: [
      "deepseek-v4-flash-free",
      "nemotron-3-ultra-free",
      "mimo-v2.5-free",
      "north-mini-code-free",
      "big-pickle",
    ],
  },
};

// Map FE-friendly: { provider: string[] }
export const MODELS_BY_PROVIDER: Record<AIProvider, string[]> = Object.fromEntries(
  (Object.keys(PROVIDER_MODELS) as AIProvider[]).map((p) => [p, PROVIDER_MODELS[p].models]),
) as Record<AIProvider, string[]>;
