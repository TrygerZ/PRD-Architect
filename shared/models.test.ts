import { describe, it, expect } from "vitest";
import {
  PROVIDER_PRESETS,
  DEFAULT_MAX_TOKENS,
  MIN_MAX_TOKENS,
  MAX_MAX_TOKENS,
  normalizeChatEndpoint,
  deriveModelsEndpoint,
  deriveEndpointLabel,
  clampMaxTokens,
  migrateLegacySettings,
} from "./models";

describe("PROVIDER_PRESETS", () => {
  it("contains all expected OpenAI-compatible presets including Custom and Ollama (Local)", () => {
    const ids = PROVIDER_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "openrouter",
        "openai",
        "deepseek",
        "gemini",
        "groq",
        "nine_router",
        "ollama",
        "custom",
      ]),
    );
    const ollama = PROVIDER_PRESETS.find((p) => p.id === "ollama");
    expect(ollama?.requiresApiKey).toBe(false);
    expect(ollama?.baseUrl).toBe("http://localhost:11434/v1");

    const openrouter = PROVIDER_PRESETS.find((p) => p.id === "openrouter");
    expect(openrouter?.requiresApiKey).toBe(true);
    expect(openrouter?.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(openrouter?.sampleModels.length).toBeGreaterThan(0);
  });
});

describe("normalizeChatEndpoint", () => {
  it("appends /chat/completions to base URLs with or without trailing slashes", () => {
    expect(normalizeChatEndpoint("https://openrouter.ai/api/v1")).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(normalizeChatEndpoint("https://openrouter.ai/api/v1/")).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(normalizeChatEndpoint("https://api.openai.com/v1///")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(normalizeChatEndpoint("https://generativelanguage.googleapis.com/v1beta/openai")).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect(normalizeChatEndpoint("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
    expect(normalizeChatEndpoint("https://api.deepseek.com")).toBe(
      "https://api.deepseek.com/chat/completions",
    );
  });

  it("preserves full /chat/completions URLs without duplicating path", () => {
    expect(normalizeChatEndpoint("https://api.deepseek.com/chat/completions")).toBe(
      "https://api.deepseek.com/chat/completions",
    );
    expect(normalizeChatEndpoint("https://api.openai.com/v1/chat/completions/")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(normalizeChatEndpoint("https://api.9router.com/v1/chat/completions?foo=1")).toBe(
      "https://api.9router.com/v1/chat/completions?foo=1",
    );
  });

  it("rejects empty strings, malformed URLs, and non-http(s) protocols", () => {
    expect(normalizeChatEndpoint("")).toBeNull();
    expect(normalizeChatEndpoint("   ")).toBeNull();
    expect(normalizeChatEndpoint("not-a-url")).toBeNull();
    expect(normalizeChatEndpoint("file:///etc/passwd")).toBeNull();
    expect(normalizeChatEndpoint("javascript:alert(1)")).toBeNull();
    expect(normalizeChatEndpoint("ftp://example.com/v1")).toBeNull();
  });
});

describe("deriveModelsEndpoint", () => {
  it("maps base URLs and chat/completions URLs to sibling /models endpoint", () => {
    expect(deriveModelsEndpoint("https://openrouter.ai/api/v1/chat/completions")).toBe(
      "https://openrouter.ai/api/v1/models",
    );
    expect(deriveModelsEndpoint("https://openrouter.ai/api/v1")).toBe(
      "https://openrouter.ai/api/v1/models",
    );
    expect(deriveModelsEndpoint("https://api.deepseek.com/chat/completions")).toBe(
      "https://api.deepseek.com/models",
    );
    expect(deriveModelsEndpoint("http://localhost:11434/v1/")).toBe(
      "http://localhost:11434/v1/models",
    );
    expect(deriveModelsEndpoint("https://openrouter.ai/api/v1/models")).toBe(
      "https://openrouter.ai/api/v1/models",
    );
  });

  it("returns null for invalid or non-http URLs", () => {
    expect(deriveModelsEndpoint("")).toBeNull();
    expect(deriveModelsEndpoint("file:///etc/passwd")).toBeNull();
  });
});

describe("deriveEndpointLabel", () => {
  it("matches known preset labels whether given a base URL or full chat completions URL", () => {
    expect(deriveEndpointLabel("https://openrouter.ai/api/v1")).toBe("OpenRouter");
    expect(deriveEndpointLabel("https://openrouter.ai/api/v1/chat/completions")).toBe("OpenRouter");
    expect(deriveEndpointLabel("https://api.openai.com/v1")).toBe("OpenAI");
    expect(deriveEndpointLabel("https://api.deepseek.com/chat/completions")).toBe("DeepSeek");
    expect(deriveEndpointLabel("https://generativelanguage.googleapis.com/v1beta/openai")).toBe("Gemini");
    expect(deriveEndpointLabel("https://api.groq.com/openai/v1")).toBe("Groq");
    expect(deriveEndpointLabel("https://api.9router.com/v1/chat/completions")).toBe("9Router");
    expect(deriveEndpointLabel("http://localhost:11434/v1")).toBe("Ollama (Local)");
  });

  it("falls back to hostname for custom gateways and safe fallback for empty/invalid URLs", () => {
    expect(deriveEndpointLabel("https://proxy.acme.internal:8443/v1")).toBe("proxy.acme.internal");
    expect(deriveEndpointLabel("")).toBe("Custom");
    expect(deriveEndpointLabel("invalid")).toBe("Custom");
  });
});

describe("clampMaxTokens", () => {
  it("clamps numeric and numeric-string inputs into [MIN_MAX_TOKENS, MAX_MAX_TOKENS]", () => {
    expect(MIN_MAX_TOKENS).toBe(1024);
    expect(MAX_MAX_TOKENS).toBe(131072);
    expect(DEFAULT_MAX_TOKENS).toBe(16384);
    expect(clampMaxTokens(32768)).toBe(32768);
    expect(clampMaxTokens("65536")).toBe(65536);
    expect(clampMaxTokens(100)).toBe(1024);
    expect(clampMaxTokens(999999)).toBe(131072);
    expect(clampMaxTokens(32768.9)).toBe(32768);
  });

  it("falls back cleanly for undefined, NaN, negative, or non-numeric inputs", () => {
    expect(clampMaxTokens(undefined)).toBe(DEFAULT_MAX_TOKENS);
    expect(clampMaxTokens(null)).toBe(DEFAULT_MAX_TOKENS);
    expect(clampMaxTokens("abc")).toBe(DEFAULT_MAX_TOKENS);
    expect(clampMaxTokens(Number.NaN)).toBe(DEFAULT_MAX_TOKENS);
    expect(clampMaxTokens(-50, 8192)).toBe(8192);
  });
});

describe("migrateLegacySettings", () => {
  it("migrates legacy deepseek, gemini, opencode settings to their OpenAI-compatible base URLs", () => {
    expect(
      migrateLegacySettings({ provider: "deepseek", model: "deepseek-chat", endpoint: "" }),
    ).toEqual({
      endpoint: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      maxTokens: DEFAULT_MAX_TOKENS,
    });

    expect(
      migrateLegacySettings({ provider: "gemini", model: "gemini-2.5-pro", endpoint: null }),
    ).toEqual({
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-pro",
      maxTokens: DEFAULT_MAX_TOKENS,
    });

    expect(
      migrateLegacySettings({ provider: "opencode", model: null, endpoint: null }),
    ).toEqual({
      endpoint: "https://opencode.ai/zen/v1",
      model: "deepseek-v4-flash-free",
      maxTokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("preserves custom endpoint and custom model for nine_router or already-migrated users", () => {
    expect(
      migrateLegacySettings({
        provider: "nine_router",
        model: "anthropic/claude-sonnet-4",
        endpoint: "https://my.proxy.dev/v1",
        maxTokens: "32768",
      }),
    ).toEqual({
      endpoint: "https://my.proxy.dev/v1",
      model: "anthropic/claude-sonnet-4",
      maxTokens: 32768,
    });

    expect(
      migrateLegacySettings({
        provider: "openai_compatible",
        model: "openai/gpt-4o",
        endpoint: "https://openrouter.ai/api/v1",
      }),
    ).toEqual({
      endpoint: "https://openrouter.ai/api/v1",
      model: "openai/gpt-4o",
      maxTokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("falls back to OpenRouter defaults for brand-new users with empty storage", () => {
    const res = migrateLegacySettings({});
    expect(res.endpoint).toBe("https://openrouter.ai/api/v1");
    expect(res.model.length).toBeGreaterThan(0);
    expect(res.maxTokens).toBe(DEFAULT_MAX_TOKENS);
  });
});
