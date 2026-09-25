import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { assertPublicEndpoint, isPrivateAddress, allowPrivateEndpoints, resolveEndpoint, resolveApiKey } from "./endpoint";
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

describe("resolveApiKey", () => {
  it("prefers the cookie key over the env key", () => {
    process.env.DEEPSEEK_API_KEY = "env-key";
    expect(resolveApiKey("deepseek", false, "cookie-key").apiKey).toBe("cookie-key");
  });

  it("falls back to the env key for builtin providers", () => {
    process.env.DEEPSEEK_API_KEY = "env-key";
    expect(resolveApiKey("deepseek", false, undefined).apiKey).toBe("env-key");
  });

  it("never forwards the env key to a custom endpoint", () => {
    process.env.NINE_ROUTER_API_KEY = "env-key";
    expect(resolveApiKey("nine_router", true, undefined).apiKey).toBeUndefined();
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
