import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePRD } from "./aiService";
import { AIProvider } from "../types";

describe("generatePRD service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends nine_router provider and customEndpoint payload correctly", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          let readCount = 0;
          return {
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode('data: {"text":"# Test PRD"}\n\ndata: [DONE]\n\n'),
                };
              }
              return { done: true, value: undefined };
            },
            cancel: vi.fn().mockResolvedValue(undefined),
          };
        },
      },
    });

    vi.stubGlobal("fetch", mockFetch);

    const onChunk = vi.fn();
    await generatePRD(
      "Test prompt",
      "test-key",
      "nine_router" as AIProvider,
      "gpt-4o-mini",
      "id",
      "SaaS",
      [],
      "initial",
      "business",
      undefined,
      onChunk,
      "https://api.9router.com/v1/chat/completions"
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/generate-prd");
    const body = JSON.parse(options.body);
    expect(body.provider).toBe("nine_router");
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.customEndpoint).toBe("https://api.9router.com/v1/chat/completions");
    expect(onChunk).toHaveBeenCalledWith({ text: "# Test PRD", reasoning: "" });
  });

  it("does not retry when stream yields data.error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          let readCount = 0;
          return {
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode('data: {"error":"API KEY tidak ditemukan..."}\n\n'),
                };
              }
              return { done: true, value: undefined };
            },
            cancel: vi.fn().mockResolvedValue(undefined),
          };
        },
      },
    });

    vi.stubGlobal("fetch", mockFetch);

    const onChunk = vi.fn();
    await expect(
      generatePRD(
        "Test prompt",
        undefined,
        "deepseek",
        "deepseek-v4-flash",
        "id",
        "SaaS",
        [],
        "initial",
        "business",
        undefined,
        onChunk
      )
    ).rejects.toThrow("API KEY tidak ditemukan...");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network error before response is established", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network connection failed"));

    vi.stubGlobal("fetch", mockFetch);

    const onChunk = vi.fn();
    await expect(
      generatePRD(
        "Test prompt",
        undefined,
        "deepseek",
        "deepseek-v4-flash",
        "id",
        "SaaS",
        [],
        "initial",
        "business",
        undefined,
        onChunk
      )
    ).rejects.toThrow("Network connection failed");

    // Initial attempt + 2 retries = 3 attempts total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry when response is 400 client error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Unknown block id" }),
    });

    vi.stubGlobal("fetch", mockFetch);

    const onChunk = vi.fn();
    await expect(
      generatePRD(
        "Test prompt",
        undefined,
        "deepseek",
        "deepseek-v4-flash",
        "id",
        "SaaS",
        [],
        "initial",
        "business",
        undefined,
        onChunk
      )
    ).rejects.toThrow("Unknown block id");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
