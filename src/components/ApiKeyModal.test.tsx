// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { ApiKeyModal } from "./ApiKeyModal";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe("ApiKeyModal auth rate-limit deduplication", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls /api/auth/set-key only once across Fetch Models, Test Connection, and Save Settings for the same key", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/set-key") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url === "/api/models") {
        return new Response(
          JSON.stringify({ ok: true, models: [{ id: "anthropic/claude-sonnet-4" }] }),
          { status: 200 },
        );
      }
      if (url === "/api/test-connection") {
        return new Response(
          JSON.stringify({ ok: true, model: "anthropic/claude-sonnet-4", latencyMs: 120 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onSave = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root?.render(
        <ApiKeyModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          language="en"
          initialEndpoint="https://openrouter.ai/api/v1"
          initialModel="anthropic/claude-sonnet-4"
          initialMaxTokens={16384}
        />,
      );
    });

    const keyInput = container!.querySelector<HTMLInputElement>("#custom-api-key");
    expect(keyInput).toBeTruthy();

    // Type API key once using React's native value setter
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      nativeSetter?.call(keyInput, "sk-or-test-key-123");
      keyInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const findBtn = (label: string) =>
      Array.from(container!.querySelectorAll("button")).find((b) =>
        b.textContent?.includes(label),
      ) as HTMLButtonElement | undefined;

    await act(async () => {
      findBtn("Fetch Models")?.click();
    });
    await act(async () => {
      findBtn("Test Connection")?.click();
    });
    await act(async () => {
      findBtn("Save Settings")?.click();
    });

    const setKeyCalls = fetchMock.mock.calls.filter(([u]) => String(u) === "/api/auth/set-key");
    expect(setKeyCalls).toHaveLength(1);
    expect(onSave).toHaveBeenCalledOnce();
  });
});
