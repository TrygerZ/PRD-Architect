// @vitest-environment jsdom
import React, { act } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { BlueprintSheet } from "./BlueprintSheet";
import type { PRDVersion } from "../types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe("BlueprintSheet continuation and truncation UI", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

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
  });

  const baseVersion: PRDVersion = {
    id: "v1",
    timestamp: Date.now(),
    content: "## 1. Executive Summary\nBody 1\n\n## 2. Problem\nBody 2",
    prompt: "Build RuangReka",
    productType: "Mobile App",
    prdMode: "business",
    customChapterIds: Array.from({ length: 15 }, (_, i) => `block-${i + 1}`),
  };

  it("shows continuing attempt pill while streaming auto-continuation", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <BlueprintSheet
          content={baseVersion.content}
          versions={[baseVersion]}
          activeVersionId="v1"
          isGenerating={true}
          continuingStatus={{ attempt: 2, maxAttempts: 5 }}
          language="en"
        />,
      );
    });

    expect(container.textContent).toContain("CONTINUING (2/5)");
    expect(container.textContent).not.toContain("Continue Generating");
  });

  it("renders incomplete banner and invokes onContinue when document stops early", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const onContinue = vi.fn();

    act(() => {
      root?.render(
        <BlueprintSheet
          content={baseVersion.content}
          versions={[baseVersion]}
          activeVersionId="v1"
          isGenerating={false}
          truncatedInfo={{
            reason: "length",
            finishReason: "length",
            detectedChapters: 2,
            expectedChapters: 15,
          }}
          onContinue={onContinue}
          language="en"
        />,
      );
    });

    expect(container.textContent).toContain("Document incomplete (2/15 chapters)");
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue Generating"),
    );
    expect(btn).toBeTruthy();

    act(() => {
      btn?.click();
    });
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("hides incomplete banner once all expected chapters are present without length truncation", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const completeVersion: PRDVersion = {
      ...baseVersion,
      customChapterIds: ["a", "b"],
    };

    act(() => {
      root?.render(
        <BlueprintSheet
          content={completeVersion.content}
          versions={[completeVersion]}
          activeVersionId="v1"
          isGenerating={false}
          truncatedInfo={null}
          onContinue={vi.fn()}
          language="en"
        />,
      );
    });

    expect(container.textContent).not.toContain("Document incomplete");
    expect(container.textContent).not.toContain("Continue Generating");
  });
});
