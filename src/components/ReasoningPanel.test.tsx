// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReasoningPanel } from "./ReasoningPanel";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ReasoningPanel live elapsed timer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T08:00:00.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("advances elapsed timer during rapid streaming chunks arriving faster than 100ms", async () => {
    await act(async () => {
      root.render(
        <ReasoningPanel reasoning="Step 1" isGenerating={true} language="en" />,
      );
    });

    // Simulate 10 rapid SSE reasoning chunks arriving every 40ms (400ms total)
    let text = "Step 1";
    for (let i = 2; i <= 11; i++) {
      await act(async () => {
        vi.advanceTimersByTime(40);
        text += ` -> chunk ${i}`;
        root.render(
          <ReasoningPanel reasoning={text} isGenerating={true} language="en" />,
        );
      });
    }

    const bodyText = container.textContent ?? "";
    expect(bodyText).toMatch(/0\.[34]s/);
    expect(bodyText).not.toContain("0.0s");
  });
});
