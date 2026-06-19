import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { safeGetLocalStorage, safeSetLocalStorage } from "./storage";

describe("safe localStorage wrappers", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets and sets a value", () => {
    safeSetLocalStorage("k", "v");
    expect(safeGetLocalStorage("k")).toBe("v");
  });

  it("returns fallback when key is missing", () => {
    expect(safeGetLocalStorage("missing", "fallback")).toBe("fallback");
    expect(safeGetLocalStorage("missing")).toBe("");
  });

  it("returns fallback when localStorage.getItem throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(safeGetLocalStorage("k", "fb")).toBe("fb");
  });

  it("invokes onError callback when setItem throws", () => {
    const onError = vi.fn();
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    });
    safeSetLocalStorage("k", "v", onError);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("does not throw when setItem fails without callback", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    });
    expect(() => safeSetLocalStorage("k", "v")).not.toThrow();
  });
});
