// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useScroll, isFarFromTop, isFarFromBottom, SCROLL_THRESHOLD } from "./useScroll";

describe("useScroll metric helpers", () => {
  it("detects when far from top", () => {
    expect(isFarFromTop(0)).toBe(false);
    expect(isFarFromTop(SCROLL_THRESHOLD)).toBe(false);
    expect(isFarFromTop(SCROLL_THRESHOLD + 1)).toBe(true);
    expect(isFarFromTop(1000)).toBe(true);
  });

  it("detects when far from bottom", () => {
    const clientHeight = 600;
    const scrollHeight = 2000;

    // At top: distance = 2000 - 0 - 600 = 1400 (> 500)
    expect(isFarFromBottom({ scrollTop: 0, clientHeight, scrollHeight })).toBe(true);

    // Scrolled close to bottom: distance = 2000 - 1000 - 600 = 400 (<= 500)
    expect(isFarFromBottom({ scrollTop: 1000, clientHeight, scrollHeight })).toBe(false);

    // Exactly at bottom: distance = 2000 - 1400 - 600 = 0 (<= 500)
    expect(isFarFromBottom({ scrollTop: 1400, clientHeight, scrollHeight })).toBe(false);

    // Short content (no scroll): distance = 400 - 0 - 600 = -200 (<= 500)
    expect(isFarFromBottom({ scrollTop: 0, clientHeight: 600, scrollHeight: 400 })).toBe(false);
  });

  it("supports custom threshold", () => {
    expect(isFarFromTop(250, 200)).toBe(true);
    expect(isFarFromTop(150, 200)).toBe(false);

    expect(isFarFromBottom({ scrollTop: 0, clientHeight: 500, scrollHeight: 800 }, 200)).toBe(true);
    expect(isFarFromBottom({ scrollTop: 0, clientHeight: 500, scrollHeight: 600 }, 200)).toBe(false);
  });
});

describe("useScroll hook lifecycle & transitions", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // @ts-expect-error React act environment flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("maintains stable hook execution across render transitions and updates state on scroll", async () => {
    let hookResult!: ReturnType<typeof useScroll>;
    const root = createRoot(container);

    function TestComponent({ threshold }: { threshold?: number }) {
      hookResult = useScroll(threshold);
      return null;
    }

    // Initial mount render
    await act(async () => {
      root.render(React.createElement(TestComponent, { threshold: 500 }));
    });

    expect(hookResult.showScrollTop).toBe(false);
    expect(hookResult.showScrollBottom).toBe(false);

    // Transition 1: Scroll to middle (far from top and far from bottom)
    await act(async () => {
      hookResult.handleScroll({
        scrollTop: 800,
        clientHeight: 600,
        scrollHeight: 3000,
      });
    });

    expect(hookResult.showScrollTop).toBe(true);
    expect(hookResult.showScrollBottom).toBe(true);

    // Transition 2: Scroll to top
    await act(async () => {
      hookResult.handleScroll({
        scrollTop: 100,
        clientHeight: 600,
        scrollHeight: 3000,
      });
    });

    expect(hookResult.showScrollTop).toBe(false);
    expect(hookResult.showScrollBottom).toBe(true);

    // Transition 3: Re-render with new prop threshold (ensuring no hook order mismatch)
    await act(async () => {
      root.render(React.createElement(TestComponent, { threshold: 200 }));
    });

    // Backward compatibility: handleScroll accepting simple number (scrollTop only)
    await act(async () => {
      hookResult.handleScroll(300);
    });

    expect(hookResult.showScrollTop).toBe(true);
    expect(hookResult.showScrollBottom).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
