import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSettings, saveSettings, SETTINGS_KEYS } from "./settings";
import { DEFAULT_MAX_TOKENS } from "../../shared/models";

describe("unified settings persistence", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to OpenRouter defaults for brand-new users", () => {
    const s = loadSettings();
    expect(s.endpoint).toBe("https://openrouter.ai/api/v1");
    expect(s.model.length).toBeGreaterThan(0);
    expect(s.maxTokens).toBe(DEFAULT_MAX_TOKENS);
  });

  it("migrates legacy deepseek storage to the unified shape and rewrites it canonically", () => {
    store[SETTINGS_KEYS.provider] = "deepseek";
    store[SETTINGS_KEYS.model] = "deepseek-v4-flash";

    const s = loadSettings();
    expect(s).toEqual({
      endpoint: "https://api.deepseek.com/v1",
      model: "deepseek-v4-flash",
      maxTokens: DEFAULT_MAX_TOKENS,
    });
    expect(store[SETTINGS_KEYS.provider]).toBe("openai_compatible");
    expect(store[SETTINGS_KEYS.endpoint]).toBe("https://api.deepseek.com/v1");
    expect(store[SETTINGS_KEYS.maxTokens]).toBe(String(DEFAULT_MAX_TOKENS));
  });

  it("keeps a legacy nine_router custom endpoint and is idempotent on reload", () => {
    store[SETTINGS_KEYS.provider] = "nine_router";
    store[SETTINGS_KEYS.model] = "claude-3-5-sonnet";
    store[SETTINGS_KEYS.endpoint] = "https://my.proxy.dev/v1/chat/completions";

    const first = loadSettings();
    const second = loadSettings();
    expect(first.endpoint).toBe("https://my.proxy.dev/v1/chat/completions");
    expect(second).toEqual(first);
  });

  it("saves and reloads settings, clamping an out-of-range maxTokens", () => {
    saveSettings({ endpoint: "http://localhost:11434/v1", model: "llama3.3", maxTokens: 999999999 });
    expect(loadSettings()).toEqual({
      endpoint: "http://localhost:11434/v1",
      model: "llama3.3",
      maxTokens: 131072,
    });
    expect(store[SETTINGS_KEYS.provider]).toBe("openai_compatible");
  });
});
