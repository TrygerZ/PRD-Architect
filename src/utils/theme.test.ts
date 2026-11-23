import { describe, it, expect, afterEach, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  resolveTheme,
  applyTheme,
  initTheme,
} from "./theme";

describe("theme utilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the expected storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("PRD_THEME");
  });

  it("defaults to dark when value is null, undefined, empty, or invalid", () => {
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme(undefined)).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
    expect(resolveTheme("sepia")).toBe("dark");
    expect(resolveTheme("DARK")).toBe("dark");
  });

  it("accepts dark and light verbatim", () => {
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });

  it("applyTheme is safe when document is unavailable", () => {
    expect(() => applyTheme("dark")).not.toThrow();
    expect(() => applyTheme("light")).not.toThrow();
  });

  it("applyTheme sets data-theme on documentElement and updates theme-color meta", () => {
    const dataset: Record<string, string> = {};
    const metaEl = {
      content: "",
      setAttribute: vi.fn((name: string, value: string) => {
        if (name === "content") metaEl.content = value;
      }),
    };
    vi.stubGlobal("document", {
      documentElement: { dataset },
      querySelector: vi.fn((selector: string) =>
        selector === 'meta[name="theme-color"]' ? metaEl : null,
      ),
    });

    applyTheme("light");
    expect(dataset.theme).toBe("light");
    expect(metaEl.content).toBe("#E2E4E9");

    applyTheme("dark");
    expect(dataset.theme).toBe("dark");
    expect(metaEl.content).toBe("#08090C");
  });

  it("initTheme falls back safely to dark when localStorage throws or holds corrupted data", () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", {
      documentElement: { dataset },
      querySelector: vi.fn(() => null),
    });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    });

    expect(initTheme()).toBe("dark");
    expect(dataset.theme).toBe("dark");

    vi.stubGlobal("localStorage", {
      getItem: () => "sepia",
      setItem: vi.fn(),
    });

    expect(initTheme()).toBe("dark");
    expect(dataset.theme).toBe("dark");
  });

  it("initTheme reads valid light theme from localStorage and applies it", () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", {
      documentElement: { dataset },
      querySelector: vi.fn(() => null),
    });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "PRD_THEME" ? "light" : null),
      setItem: vi.fn(),
    });

    expect(initTheme()).toBe("light");
    expect(dataset.theme).toBe("light");
  });
});
