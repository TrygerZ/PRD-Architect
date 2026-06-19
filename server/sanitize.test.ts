import { describe, it, expect } from "vitest";
import { sanitizeCellForAI } from "./sanitize";

describe("sanitizeCellForAI", () => {
  it("returns empty string for null/undefined", () => {
    expect(sanitizeCellForAI(null)).toBe("");
    expect(sanitizeCellForAI(undefined)).toBe("");
  });

  it("passes through safe text unchanged", () => {
    expect(sanitizeCellForAI("hello world")).toBe("hello world");
    expect(sanitizeCellForAI(42)).toBe("42");
  });

  it.each(["=", "+", "-", "@", "|", "%"])(
    "neutralizes leading formula character %s",
    (prefix) => {
      const out = sanitizeCellForAI(`${prefix}CMD()`);
      expect(out).toBe(`'${prefix}CMD()`);
    }
  );

  it("does not neutralize formula characters in the middle", () => {
    expect(sanitizeCellForAI("a=b")).toBe("a=b");
    expect(sanitizeCellForAI("10%off")).toBe("10%off");
  });

  it("coerces non-string primitives", () => {
    expect(sanitizeCellForAI(true)).toBe("true");
    expect(sanitizeCellForAI(0)).toBe("0");
  });
});
