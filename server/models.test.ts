import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseModelsPayload, fetchUpstreamModels, MAX_REMOTE_MODELS } from "./models";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseModelsPayload", () => {
  it("parses standard OpenAI /models payload, deduplicates, and sorts alphabetically", () => {
    const payload = {
      object: "list",
      data: [
        { id: "openai/gpt-4o", context_length: 128000 },
        { id: "anthropic/claude-sonnet-4", context_length: 200000 },
        { id: "openai/gpt-4o", context_length: 128000 },
        { id: "  deepseek/deepseek-r1  ", max_context_length: 65536 },
        { id: "" },
        null,
      ],
    };
    expect(parseModelsPayload(payload)).toEqual([
      { id: "anthropic/claude-sonnet-4", contextLength: 200000 },
      { id: "deepseek/deepseek-r1", contextLength: 65536 },
      { id: "openai/gpt-4o", contextLength: 128000 },
    ]);
  });

  it("caps returned models at limit (default 500)", () => {
    expect(MAX_REMOTE_MODELS).toBe(500);
    const data = Array.from({ length: 650 }, (_, i) => ({
      id: `model-${String(i).padStart(4, "0")}`,
    }));
    const res = parseModelsPayload({ data });
    expect(res).toHaveLength(500);
    expect(res[0].id).toBe("model-0000");
  });

  it("returns empty array for malformed or non-object payloads", () => {
    expect(parseModelsPayload(null)).toEqual([]);
    expect(parseModelsPayload("<html>error</html>")).toEqual([]);
    expect(parseModelsPayload({ data: "not-an-array" })).toEqual([]);
    expect(parseModelsPayload({})).toEqual([]);
  });
});

describe("fetchUpstreamModels", () => {
  it("fetches models with Bearer header when apiKey is present", async () => {
    let capturedHeaders: HeadersInit | undefined;
    const fakeFetch: typeof fetch = vi.fn(async (_url, init) => {
      capturedHeaders = init?.headers;
      return new Response(
        JSON.stringify({ data: [{ id: "gpt-4o" }, { id: "claude-sonnet-4", context_length: 200000 }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const res = await fetchUpstreamModels({
      modelsUrl: "https://openrouter.ai/api/v1/models",
      apiKey: "sk-test-123",
      language: "en",
      fetchImpl: fakeFetch,
    });

    expect(res).toEqual({
      ok: true,
      models: [
        { id: "claude-sonnet-4", contextLength: 200000 },
        { id: "gpt-4o" },
      ],
    });
    expect((capturedHeaders as Record<string, string>)?.Authorization).toBe("Bearer sk-test-123");
  });

  it("omits Authorization header when apiKey is undefined (local endpoints)", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const fakeFetch: typeof fetch = vi.fn(async (_url, init) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ data: [{ id: "llama3.3" }] }), { status: 200 });
    });

    const res = await fetchUpstreamModels({
      modelsUrl: "http://localhost:11434/v1/models",
      apiKey: undefined,
      language: "en",
      fetchImpl: fakeFetch,
    });

    expect(res).toEqual({ ok: true, models: [{ id: "llama3.3" }] });
    expect(capturedHeaders?.Authorization).toBeUndefined();
  });

  it("never leaks raw upstream error bodies to client on HTTP errors", async () => {
    const fakeFetch: typeof fetch = vi.fn(async () => {
      return new Response("SECRET_INTERNAL_STACK_TRACE_XYZ", { status: 401 });
    });

    const res = await fetchUpstreamModels({
      modelsUrl: "https://openrouter.ai/api/v1/models",
      apiKey: "bad-key",
      language: "en",
      fetchImpl: fakeFetch,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).not.toContain("SECRET_INTERNAL_STACK_TRACE_XYZ");
      expect(res.error.length).toBeGreaterThan(0);
    }
  });

  it("handles non-JSON HTML responses cleanly without throwing", async () => {
    const fakeFetch: typeof fetch = vi.fn(async () => {
      return new Response("<html><body>Not JSON</body></html>", { status: 200 });
    });

    const res = await fetchUpstreamModels({
      modelsUrl: "https://example.com/v1/models",
      apiKey: "key",
      language: "id",
      fetchImpl: fakeFetch,
    });

    expect(res.ok).toBe(false);
  });

  it("returns bilingual timeout message when upstream aborts", async () => {
    const fakeFetch: typeof fetch = vi.fn(async () => {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    });

    const resEn = await fetchUpstreamModels({
      modelsUrl: "https://example.com/v1/models",
      language: "en",
      fetchImpl: fakeFetch,
    });
    const resId = await fetchUpstreamModels({
      modelsUrl: "https://example.com/v1/models",
      language: "id",
      fetchImpl: fakeFetch,
    });

    expect(resEn.ok).toBe(false);
    expect(resId.ok).toBe(false);
    if (!resEn.ok && !resId.ok) {
      expect(resEn.error).not.toBe(resId.error);
    }
  });
});
