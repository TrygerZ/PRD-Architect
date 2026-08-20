// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { splitDetailBlocks } from "./DetailPanel";

describe("splitDetailBlocks", () => {
  it("splits MoSCoW table + prose context into table/text blocks", () => {
    const blocks = splitDetailBlocks("**Must-have**\n\n| Feature | Description |\n|---|---|\n| Login | Auth |\n\nNote text.");
    expect(blocks.map((b) => b.kind)).toEqual(["text", "table", "text"]);
    if (blocks[1].kind === "table") expect(blocks[1].md).toContain("| Feature | Description |");
  });

  it("pipe lines without GFM separator are text, not table", () => {
    const blocks = splitDetailBlocks("| A | B |\njust pipes");
    expect(blocks.map((b) => b.kind)).toEqual(["text", "text"]);
  });

  it("bullet block parses into a tree (V2 detail breakdown)", () => {
    const blocks = splitDetailBlocks("- **Modul A**\n  - Fitur\n    - Sub\n- **Modul B**\n  - Fitur 2");
    expect(blocks.map((b) => b.kind)).toEqual(["bullets"]);
    if (blocks[0].kind === "bullets") {
      expect(blocks[0].items.map((m) => m.title)).toEqual(["Modul A", "Modul B"]);
      expect(blocks[0].items[0].children[0].children[0].title).toBe("Sub");
    }
  });

  it("empty / falsy input → []", () => {
    expect(splitDetailBlocks("")).toEqual([]);
    expect(splitDetailBlocks("   \n  ")).toEqual([]);
  });
});