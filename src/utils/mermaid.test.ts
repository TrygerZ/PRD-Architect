import { describe, it, expect } from "vitest";
import { sanitizeMermaid } from "./mermaid";

describe("sanitizeMermaid", () => {
  it("returns empty string for non-string input", () => {
    // @ts-expect-error testing defensive runtime guard
    expect(sanitizeMermaid(null)).toBe("");
    // @ts-expect-error testing defensive runtime guard
    expect(sanitizeMermaid(undefined)).toBe("");
    // @ts-expect-error testing defensive runtime guard
    expect(sanitizeMermaid(123)).toBe("");
  });

  it("leaves clean charts unchanged", () => {
    const chart = "graph TD\n  A --> B\n  B --> C";
    expect(sanitizeMermaid(chart)).toBe(chart);
  });

  it("replaces parentheses inside edge labels with brackets", () => {
    const chart = "graph TD\n  A -->|Send Data (REST)| B";
    const out = sanitizeMermaid(chart);
    expect(out).toContain("|Send Data [REST]|");
    expect(out).not.toContain("(REST)");
  });

  it("wraps node labels containing parentheses in quotes", () => {
    const chart = "graph TD\n  A[User (Logged In)] --> B";
    const out = sanitizeMermaid(chart);
    expect(out).toContain('A["User (Logged In)"]');
  });

  it("wraps node labels containing commas in quotes", () => {
    const chart = "graph TD\n  A[One, Two, Three] --> B";
    const out = sanitizeMermaid(chart);
    expect(out).toContain('A["One, Two, Three"]');
  });

  it("wraps decision nodes containing parentheses in quotes", () => {
    const chart = "graph TD\n  A{Is valid (yes/no)} --> B";
    const out = sanitizeMermaid(chart);
    expect(out).toContain('{"Is valid (yes/no)"}');
  });

  it("does not double-wrap already-quoted node labels", () => {
    const chart = 'graph TD\n  A["User (Logged In)"] --> B';
    const out = sanitizeMermaid(chart);
    expect(out).toBe(chart);
  });

  it("skips shape-specific cylinder nodes", () => {
    const chart = "graph TD\n  A[(Database)] --> B";
    const out = sanitizeMermaid(chart);
    expect(out).toContain("A[(Database)]");
  });

  it("preserves comments untouched", () => {
    const chart = "graph TD\n  %% this is a (comment)\n  A[Node (x)] --> B";
    const out = sanitizeMermaid(chart);
    expect(out).toContain("%% this is a (comment)");
    expect(out).toContain('A["Node (x)"]');
  });

  describe("ERD sanitization", () => {
    it("converts PRIMARY KEY to PK on attribute lines", () => {
      const chart = "erDiagram\n  USER {\n    int id PRIMARY KEY\n    varchar name\n  }";
      const out = sanitizeMermaid(chart);
      expect(out).toContain("int id PK");
      expect(out).not.toMatch(/PRIMARY\s+KEY/);
    });

    it("removes NOT NULL and collapses whitespace", () => {
      const chart = "erDiagram\n  USER {\n    varchar email NOT NULL\n  }";
      const out = sanitizeMermaid(chart);
      expect(out).not.toMatch(/NOT\s+NULL/);
      expect(out).toContain("varchar email");
    });

    it("keeps only the first key constraint per attribute line", () => {
      const chart = "erDiagram\n  USER {\n    int id PK FK\n  }";
      const out = sanitizeMermaid(chart);
      // Should keep PK, drop the duplicate constraint
      const attrLine = out.split("\n").find((l) => l.includes("id"))!;
      const keyCount = (attrLine.match(/\b(PK|FK|UK)\b/g) || []).length;
      expect(keyCount).toBe(1);
    });

    it("does not touch entity declaration / relationship lines", () => {
      const chart = 'erDiagram\n  USER ||--o{ ORDER : places';
      const out = sanitizeMermaid(chart);
      expect(out).toContain("USER ||--o{ ORDER : places");
    });
  });
});
