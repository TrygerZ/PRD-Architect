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
});
