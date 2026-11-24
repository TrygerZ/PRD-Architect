// Katalog model & endpoint terpusat — single source of truth untuk FE & BE.
// FE (ApiKeyModal) membaca `models` + `defaultModel`.
// BE (server.ts) membaca `endpoint`, `defaultModel`, dan `apiKeyEnvName`.
// Endpoint harus konsisten dengan CSP connectSrc di server.ts.

import type { AIProvider, LegacyAIProvider, ProviderPreset } from "./types";

export const DEFAULT_MAX_TOKENS = 16384;
export const MIN_MAX_TOKENS = 1024;
export const MAX_MAX_TOKENS = 131072;

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-4",
    sampleModels: [
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "deepseek/deepseek-r1",
      "google/gemini-2.5-pro",
    ],
    requiresApiKey: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    sampleModels: ["gpt-4o", "gpt-4.1", "o3-mini"],
    requiresApiKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    sampleModels: ["deepseek-chat", "deepseek-reasoner"],
    requiresApiKey: true,
  },
  {
    id: "gemini",
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    sampleModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    requiresApiKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    sampleModels: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
    requiresApiKey: true,
  },
  {
    id: "nine_router",
    label: "9Router",
    baseUrl: "https://api.9router.com/v1",
    defaultModel: "gpt-4o-mini",
    sampleModels: ["gpt-4o-mini", "claude-3-5-sonnet", "deepseek-v3", "gemini-2.5-flash"],
    requiresApiKey: true,
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.3",
    sampleModels: ["llama3.3", "qwen2.5:32b", "deepseek-r1:14b"],
    requiresApiKey: false,
  },
  {
    id: "custom",
    label: "Custom",
    baseUrl: "",
    defaultModel: "",
    sampleModels: [],
    requiresApiKey: true,
  },
];

export const LEGACY_PROVIDER_BASE_URLS: Record<
  LegacyAIProvider,
  { baseUrl: string; defaultModel: string; envKey: string }
> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
  },
  opencode: {
    baseUrl: "https://opencode.ai/zen/v1",
    defaultModel: "deepseek-v4-flash-free",
    envKey: "OPENCODE_API_KEY",
  },
  nine_router: {
    baseUrl: "https://api.9router.com/v1",
    defaultModel: "gpt-4o-mini",
    envKey: "NINE_ROUTER_API_KEY",
  },
};

function parseHttpUrl(raw: string): URL | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeChatEndpoint(raw: string): string | null {
  const parsed = parseHttpUrl(raw);
  if (!parsed) return null;

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = cleanPath.endsWith("/chat/completions")
    ? cleanPath
    : `${cleanPath}/chat/completions`;
  return parsed.toString();
}

export function deriveModelsEndpoint(chatEndpoint: string): string | null {
  const parsed = parseHttpUrl(chatEndpoint);
  if (!parsed) return null;

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  if (cleanPath.endsWith("/chat/completions")) {
    parsed.pathname = `${cleanPath.slice(0, -"/chat/completions".length)}/models`;
  } else if (cleanPath.endsWith("/models")) {
    parsed.pathname = cleanPath;
  } else {
    parsed.pathname = `${cleanPath}/models`;
  }
  return parsed.toString();
}

export function deriveEndpointLabel(endpointOrBaseUrl: string): string {
  const parsed = parseHttpUrl(endpointOrBaseUrl);
  if (!parsed) return "Custom";

  const cleanHref = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  const prefixMatch = PROVIDER_PRESETS.find((preset) => {
    if (!preset.baseUrl) return false;
    const cleanBase = preset.baseUrl.replace(/\/+$/, "");
    return cleanHref === cleanBase || cleanHref.startsWith(`${cleanBase}/`);
  });
  if (prefixMatch) return prefixMatch.label;

  const hostMatch = PROVIDER_PRESETS.find((preset) => {
    if (!preset.baseUrl) return false;
    const presetUrl = parseHttpUrl(preset.baseUrl);
    return presetUrl !== null && presetUrl.host.toLowerCase() === parsed.host.toLowerCase();
  });
  if (hostMatch) return hostMatch.label;

  return parsed.hostname || "Custom";
}

export function clampMaxTokens(value: unknown, fallback: number = DEFAULT_MAX_TOKENS): number {
  let num: number;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    num = Number(trimmed);
  } else {
    return fallback;
  }

  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(MAX_MAX_TOKENS, Math.max(MIN_MAX_TOKENS, Math.floor(num)));
}

export function migrateLegacySettings(stored: {
  provider?: string | null;
  model?: string | null;
  endpoint?: string | null;
  maxTokens?: string | null;
}): { endpoint: string; model: string; maxTokens: number } {
  const openRouterPreset = PROVIDER_PRESETS.find((p) => p.id === "openrouter");
  const fallbackEndpoint = openRouterPreset?.baseUrl ?? "https://openrouter.ai/api/v1";
  const fallbackModel = openRouterPreset?.defaultModel ?? "anthropic/claude-sonnet-4";

  const provider = typeof stored.provider === "string" ? stored.provider.trim() : "";
  const storedEndpoint = typeof stored.endpoint === "string" ? stored.endpoint.trim() : "";
  const storedModel = typeof stored.model === "string" ? stored.model.trim() : "";
  const maxTokens = clampMaxTokens(stored.maxTokens, DEFAULT_MAX_TOKENS);

  if (provider === "deepseek" || provider === "gemini" || provider === "opencode") {
    const legacy = LEGACY_PROVIDER_BASE_URLS[provider];
    return {
      endpoint: legacy.baseUrl,
      model: storedModel || legacy.defaultModel,
      maxTokens,
    };
  }

  if (provider === "nine_router") {
    const legacy = LEGACY_PROVIDER_BASE_URLS.nine_router;
    return {
      endpoint: storedEndpoint || legacy.baseUrl,
      model: storedModel || legacy.defaultModel,
      maxTokens,
    };
  }

  return {
    endpoint: storedEndpoint || fallbackEndpoint,
    model: storedModel || fallbackModel,
    maxTokens,
  };
}

export interface ProviderConfig {
  endpoint: string;
  apiKeyEnvName: string;
  defaultModel: string;
  models: string[];
  /** Batas max_tokens untuk request generate. Fallback konsumen: 16384. */
  maxTokens?: number;
}

export const PROVIDER_MODELS: Record<AIProvider, ProviderConfig> = {
  openai_compatible: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    apiKeyEnvName: "OPENROUTER_API_KEY",
    defaultModel: "anthropic/claude-sonnet-4",
    models: [
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "deepseek/deepseek-r1",
      "google/gemini-2.5-pro",
    ],
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    apiKeyEnvName: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
    maxTokens: 65536,
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKeyEnvName: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    maxTokens: 65536,
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
    maxTokens: 65536,
  },
  nine_router: {
    endpoint: "https://api.9router.com/v1/chat/completions",
    apiKeyEnvName: "NINE_ROUTER_API_KEY",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "claude-3-5-sonnet", "deepseek-v3", "gemini-2.5-flash"],
    // Konservatif: model bebas / proxy pihak ketiga sering menolak limit besar.
    maxTokens: 16384,
  },
};

// Map FE-friendly: { provider: string[] }
export const MODELS_BY_PROVIDER: Record<AIProvider, string[]> = Object.fromEntries(
  (Object.keys(PROVIDER_MODELS) as AIProvider[]).map((p) => [p, PROVIDER_MODELS[p].models]),
) as Record<AIProvider, string[]>;
