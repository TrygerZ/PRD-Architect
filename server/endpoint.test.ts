import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { assertPublicEndpoint, isPrivateAddress, allowPrivateEndpoints, allowServerKeyFallback, resolveEndpoint, resolveApiKey } from "./endpoint";
import { PROVIDER_MODELS } from "../shared/models";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1"])(
    "flags %s as private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700::1111"])("flags %s as public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("allowPrivateEndpoints", () => {
  it("allows outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_PRIVATE_ENDPOINTS;
    expect(allowPrivateEndpoints()).toBe(true);
  });

  it("blocks in production without the flag", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PRIVATE_ENDPOINTS;
    expect(allowPrivateEndpoints()).toBe(false);
  });

  it("allows in production when the flag is true", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_PRIVATE_ENDPOINTS = "true";
    expect(allowPrivateEndpoints()).toBe(true);
  });
});

describe("assertPublicEndpoint", () => {
  it("accepts localhost when private endpoints are allowed", async () => {
    await expect(assertPublicEndpoint("http://localhost:20128/v1/chat/completions", true)).resolves.toBe(true);
    await expect(assertPublicEndpoint("http://127.0.0.1:20128/v1/chat/completions", true)).resolves.toBe(true);
  });

  it("rejects localhost when private endpoints are blocked", async () => {
    await expect(assertPublicEndpoint("http://localhost:20128/v1/chat/completions", false)).resolves.toBe(false);
    await expect(assertPublicEndpoint("http://192.168.1.5/v1/chat/completions", false)).resolves.toBe(false);
  });

  it("rejects invalid URLs regardless of the flag", async () => {
    await expect(assertPublicEndpoint("not a url", true)).resolves.toBe(false);
    await expect(assertPublicEndpoint("", true)).resolves.toBe(false);
  });

  it("accepts a public IP literal", async () => {
    await expect(assertPublicEndpoint("https://8.8.8.8/v1/chat/completions", false)).resolves.toBe(true);
  });
});

describe("resolveEndpoint", () => {
  it("uses the provider default when no custom endpoint is given", async () => {
    const res = await resolveEndpoint("deepseek", undefined);
    expect(res).toEqual({ ok: true, endpoint: PROVIDER_MODELS.deepseek.endpoint, usingCustomEndpoint: false });
  });

  it("ignores a custom endpoint for non nine_router providers", async () => {
    const res = await resolveEndpoint("gemini", "http://localhost:20128/v1/chat/completions");
    expect(res).toEqual({ ok: true, endpoint: PROVIDER_MODELS.gemini.endpoint, usingCustomEndpoint: false });
  });

  it("accepts a loopback custom endpoint outside production", async () => {
    process.env.NODE_ENV = "development";
    const res = await resolveEndpoint("nine_router", "http://localhost:20128/v1/chat/completions");
    expect(res).toEqual({ ok: true, endpoint: "http://localhost:20128/v1/chat/completions", usingCustomEndpoint: true });
  });

  it("rejects without falling back in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PRIVATE_ENDPOINTS;
    const res = await resolveEndpoint("nine_router", "http://localhost:20128/v1/chat/completions");
    expect(res).toEqual({ ok: false, reason: "private_blocked", url: "http://localhost:20128/v1/chat/completions" });
  });

  it("rejects non-http protocols", async () => {
    const res = await resolveEndpoint("nine_router", "file:///etc/passwd");
    expect(res).toEqual({ ok: false, reason: "invalid_url", url: "file:///etc/passwd" });
  });
});

describe("allowServerKeyFallback", () => {
  it("defaults to false when unset", () => {
    delete process.env.ALLOW_SERVER_KEY_FALLBACK;
    expect(allowServerKeyFallback()).toBe(false);
  });

  it("returns false for non-'true' values", () => {
    process.env.ALLOW_SERVER_KEY_FALLBACK = "false";
    expect(allowServerKeyFallback()).toBe(false);
    process.env.ALLOW_SERVER_KEY_FALLBACK = "1";
    expect(allowServerKeyFallback()).toBe(false);
  });

  it("returns true when set to 'true'", () => {
    process.env.ALLOW_SERVER_KEY_FALLBACK = "true";
    expect(allowServerKeyFallback()).toBe(true);
  });
});

describe("resolveApiKey", () => {
  it("branch 1: usingCustomEndpoint always uses only cookieKey and never forwards serverKey", () => {
    process.env.NINE_ROUTER_API_KEY = "env-key";
    // cookieKey present
    expect(resolveApiKey("nine_router", true, "user-key", true).apiKey).toBe("user-key");
    expect(resolveApiKey("nine_router", true, "user-key", false).apiKey).toBe("user-key");
    // cookieKey absent -> undefined even when fallback is true
    expect(resolveApiKey("nine_router", true, undefined, true).apiKey).toBeUndefined();
    expect(resolveApiKey("nine_router", true, undefined, false).apiKey).toBeUndefined();
  });

  it("branch 2: non-custom endpoint with cookieKey present uses cookieKey regardless of fallback flag", () => {
    process.env.DEEPSEEK_API_KEY = "env-key";
    expect(resolveApiKey("deepseek", false, "cookie-key", false).apiKey).toBe("cookie-key");
    expect(resolveApiKey("deepseek", false, "cookie-key", true).apiKey).toBe("cookie-key");
  });

  it("branch 3: non-custom endpoint with cookieKey empty and fallback=true uses serverKey", () => {
    process.env.DEEPSEEK_API_KEY = "env-key";
    expect(resolveApiKey("deepseek", false, undefined, true).apiKey).toBe("env-key");
    expect(resolveApiKey("deepseek", false, "", true).apiKey).toBe("env-key");
  });

  it("branch 4: non-custom endpoint with cookieKey empty and fallback=false returns undefined", () => {
    process.env.DEEPSEEK_API_KEY = "env-key";
    expect(resolveApiKey("deepseek", false, undefined, false).apiKey).toBeUndefined();
    expect(resolveApiKey("deepseek", false, "", false).apiKey).toBeUndefined();
    // Default fallback parameter should also be false when env is not set
    delete process.env.ALLOW_SERVER_KEY_FALLBACK;
    expect(resolveApiKey("deepseek", false, undefined).apiKey).toBeUndefined();
  });
});

describe("PROVIDER_MODELS maxTokens", () => {
  it.each([
    ["deepseek", 65536],
    ["gemini", 65536],
    ["opencode", 65536],
    ["nine_router", 16384],
  ] as const)("%s resolves to %i", (provider, expected) => {
    expect(PROVIDER_MODELS[provider].maxTokens ?? 16384).toBe(expected);
  });
});
