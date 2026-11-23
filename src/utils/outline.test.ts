import { describe, it, expect } from "vitest";
import { getSectionId, buildChapterOutline } from "./outline";

describe("getSectionId", () => {
  it("matches the BlueprintSheet and useGeneration sectionId contract", () => {
    expect(getSectionId("1. Executive Summary", 0)).toBe("sec_1__Executive_Summary_0");
    expect(getSectionId("A very long heading that exceeds thirty characters easily", 3)).toBe(
      "sec_A_very_long_heading_that_excee_3",
    );
  });
});

describe("buildChapterOutline", () => {
  it("returns empty array for empty or whitespace-only content", () => {
    expect(buildChapterOutline("", {}, false)).toEqual([]);
    expect(buildChapterOutline("   \n  ", {}, true)).toEqual([]);
  });

  it("marks earlier chapters done and the last chapter streaming while generating", () => {
    const md = [
      "## 1. Executive Summary",
      "Summary body",
      "## 2. User Personas",
      "Persona body",
      "## 3. Feature Breakdown",
      "In progress...",
    ].join("\n");

    const outline = buildChapterOutline(md, {}, true);
    expect(outline).toHaveLength(3);
    expect(outline.map((item) => item.indexLabel)).toEqual(["01", "02", "03"]);
    expect(outline.map((item) => item.status)).toEqual(["done", "done", "streaming"]);
    expect(outline.map((item) => item.title)).toEqual([
      "1. Executive Summary",
      "2. User Personas",
      "3. Feature Breakdown",
    ]);
  });

  it("marks all chapters idle when not generating and flags only non-empty trimmed comments", () => {
    const md = [
      "## 1. Executive Summary",
      "Summary body",
      "## 2. Architecture",
      "Arch body",
      "## 3. Metrics",
      "Metrics body",
    ].join("\n");

    const id0 = getSectionId("1. Executive Summary", 0);
    const id1 = getSectionId("2. Architecture", 1);
    const id2 = getSectionId("3. Metrics", 2);

    const outline = buildChapterOutline(
      md,
      {
        [id0]: "Clarify B2B target segment",
        [id1]: "   \n  ",
        [id2]: "Add latency SLO",
      },
      false,
    );

    expect(outline).toEqual([
      {
        id: id0,
        indexLabel: "01",
        title: "1. Executive Summary",
        status: "idle",
        hasComment: true,
      },
      {
        id: id1,
        indexLabel: "02",
        title: "2. Architecture",
        status: "idle",
        hasComment: false,
      },
      {
        id: id2,
        indexLabel: "03",
        title: "3. Metrics",
        status: "idle",
        hasComment: true,
      },
    ]);
  });

  it("formats two-digit index labels past chapter 9", () => {
    const md = Array.from({ length: 12 }, (_, i) => `## Ch ${i + 1}\nBody ${i + 1}`).join("\n");
    const outline = buildChapterOutline(md, {}, false);
    expect(outline[0].indexLabel).toBe("01");
    expect(outline[8].indexLabel).toBe("09");
    expect(outline[9].indexLabel).toBe("10");
    expect(outline[11].indexLabel).toBe("12");
  });
});
