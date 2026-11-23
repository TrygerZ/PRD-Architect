import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assertPublicEndpoint,
  isPrivateAddress,
  allowPrivateEndpoints,
  allowServerKeyFallback,
  resolveEndpoint,
  resolveApiKey,
  endpointErrorMessage,
} from "./endpoint";
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
  it("normalizes Base URLs for openai_compatible and sets isPrivate accurately", async () => {
    process.env.NODE_ENV = "development";
    const localRes = await resolveEndpoint("openai_compatible", "http://localhost:11434/v1");
    expect(localRes).toEqual({
      ok: true,
      endpoint: "http://localhost:11434/v1/chat/completions",
      isPrivate: true,
      usingCustomEndpoint: true,
    });

    const pubIpRes = await resolveEndpoint("openai_compatible", "https://8.8.8.8/v1");
    expect(pubIpRes).toEqual({
      ok: true,
      endpoint: "https://8.8.8.8/v1/chat/completions",
      isPrivate: false,
      usingCustomEndpoint: true,
    });
  });

  it("accepts customEndpoint even when legacy provider alias is passed", async () => {
    process.env.NODE_ENV = "development";
    const res = await resolveEndpoint("gemini", "http://localhost:20128/v1");
    expect(res).toEqual({
      ok: true,
      endpoint: "http://localhost:20128/v1/chat/completions",
      isPrivate: true,
      usingCustomEndpoint: true,
    });
  });

  it("uses legacy provider default when customEndpoint is omitted for legacy providers", async () => {
    const res = await resolveEndpoint("deepseek", undefined);
    expect(res).toEqual({
      ok: true,
      endpoint: PROVIDER_MODELS.deepseek.endpoint,
      isPrivate: false,
      usingCustomEndpoint: false,
    });
  });

  it("uses server AI_ENDPOINT when openai_compatible has no customEndpoint and AI_ENDPOINT is set", async () => {
    process.env.NODE_ENV = "production";
    process.env.AI_ENDPOINT = "https://8.8.8.8/v1";
    const res = await resolveEndpoint("openai_compatible", "");
    expect(res).toEqual({
      ok: true,
      endpoint: "https://8.8.8.8/v1/chat/completions",
      isPrivate: false,
      usingCustomEndpoint: false,
    });
  });

  it("returns missing_endpoint when openai_compatible has no customEndpoint and no server AI_ENDPOINT", async () => {
    delete process.env.AI_ENDPOINT;
    const res = await resolveEndpoint("openai_compatible", "");
    expect(res).toEqual({ ok: false, reason: "missing_endpoint", url: "" });
    if (!res.ok) {
      expect(endpointErrorMessage(res, "en")).toMatch(/endpoint/i);
      expect(endpointErrorMessage(res, "id")).toMatch(/endpoint/i);
    }
  });

  it("rejects loopback/private endpoint in production without falling back", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PRIVATE_ENDPOINTS;
    const res = await resolveEndpoint("openai_compatible", "http://localhost:11434/v1");
    expect(res).toEqual({
      ok: false,
      reason: "private_blocked",
      url: "http://localhost:11434/v1/chat/completions",
    });
  });

  it("rejects non-http protocols without falling back", async () => {
    const res = await resolveEndpoint("openai_compatible", "file:///etc/passwd");
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
  it("never forwards server .env key to third-party custom endpoints", () => {
    process.env.AI_API_KEY = "server-secret";
    process.env.NINE_ROUTER_API_KEY = "env-key";
    expect(resolveApiKey("openai_compatible", true, "user-key", true, false)).toMatchObject({
      apiKey: "user-key",
      optional: false,
    });
    expect(resolveApiKey("openai_compatible", true, undefined, true, false)).toMatchObject({
      apiKey: undefined,
      optional: false,
    });
  });

  it("marks API key optional ONLY for allowed private/local endpoints", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_PRIVATE_ENDPOINTS;
    expect(resolveApiKey("openai_compatible", true, undefined, false, true)).toMatchObject({
      apiKey: undefined,
      optional: true,
    });
    // Still passes user key if provided for local proxy that requires auth
    expect(resolveApiKey("openai_compatible", true, "local-token", false, true)).toMatchObject({
      apiKey: "local-token",
      optional: true,
    });
    // In production without ALLOW_PRIVATE_ENDPOINTS, optional is false
    process.env.NODE_ENV = "production";
    expect(resolveApiKey("openai_compatible", true, undefined, false, true)).toMatchObject({
      apiKey: undefined,
      optional: false,
    });
  });

  it("uses cookieKey over server fallback on non-custom default endpoints", () => {
    process.env.AI_API_KEY = "env-ai-key";
    process.env.DEEPSEEK_API_KEY = "env-key";
    expect(resolveApiKey("deepseek", false, "cookie-key", true, false).apiKey).toBe("cookie-key");
    expect(resolveApiKey("openai_compatible", false, "cookie-key", true, false).apiKey).toBe("cookie-key");
  });

  it("uses AI_API_KEY (or legacy env key) only when non-custom endpoint and allowFallback=true", () => {
    process.env.AI_API_KEY = "env-ai-key";
    process.env.DEEPSEEK_API_KEY = "env-deepseek-key";
    expect(resolveApiKey("openai_compatible", false, undefined, true, false)).toMatchObject({
      apiKey: "env-ai-key",
      optional: false,
    });
    expect(resolveApiKey("deepseek", false, undefined, true, false).apiKey).toBe("env-deepseek-key");
    expect(resolveApiKey("openai_compatible", false, undefined, false, false).apiKey).toBeUndefined();
  });
});
