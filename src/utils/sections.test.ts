import { describe, it, expect } from "vitest";
import { getSections } from "./sections";

describe("getSections", () => {
  it("returns empty array for empty content", () => {
    expect(getSections("")).toEqual([]);
  });

  it("splits a document on level-2 headings", () => {
    const doc = "## 1. Intro\nHello\n## 2. Body\nWorld";
    const sections = getSections(doc);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("1. Intro");
    expect(sections[1].heading).toBe("2. Body");
  });

  it("captures preamble before the first heading as Overview", () => {
    const doc = "Some intro text\n## 1. Real Section\nBody";
    const sections = getSections(doc);
    expect(sections[0].heading).toBe("Overview");
    expect(sections[0].content).toContain("Some intro text");
  });

  it("does not split on level-3 headings", () => {
    const doc = "## 1. Section\n### Subheading\nText";
    const sections = getSections(doc);
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain("### Subheading");
  });

  it("includes the heading line in the section content", () => {
    const doc = "## 1. Section\nBody";
    const sections = getSections(doc);
    expect(sections[0].content.startsWith("## 1. Section")).toBe(true);
  });

  it("filters out whitespace-only sections", () => {
    const doc = "## 1. A\nreal\n## 2. B\n   \n";
    const sections = getSections(doc);
    expect(sections.map((s) => s.heading)).toContain("1. A");
  });

  it("assigns sequential indices", () => {
    const doc = "## A\nx\n## B\ny\n## C\nz";
    const sections = getSections(doc);
    expect(sections.map((s) => s.index)).toEqual([0, 1, 2]);
  });
});
