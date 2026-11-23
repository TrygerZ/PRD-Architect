// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, afterEach } from "vitest";
import { splitDetailBlocks, formatWbsDisplayCode, DetailPanel } from "./DetailPanel";
import type { WbsNode } from "../utils/wbs";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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

describe("formatWbsDisplayCode", () => {
  it("formats internal WBS tree ids into Figma-aligned badges and prefers explicit feature codes", () => {
    expect(formatWbsDisplayCode({ id: "root", type: "root", children: [] })).toBe("ROOT");
    expect(
      formatWbsDisplayCode({
        id: "f-2",
        type: "feature",
        children: [{ id: "f-2-1", type: "subfeature", title: "A", detail: "", children: [] }],
      }),
    ).toBe("M2");
    expect(formatWbsDisplayCode({ id: "f-2-2", type: "subfeature", children: [] })).toBe("WBS-2.2");
    expect(formatWbsDisplayCode({ id: "f-2-2-1", type: "subfeature", children: [] })).toBe("WBS-2.2.1");
    expect(formatWbsDisplayCode({ id: "f-2-2", code: "FEAT-04", type: "subfeature", children: [] })).toBe("FEAT-04");
  });
});

describe("DetailPanel Figma 67:30 layout", () => {
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

  it("renders WBS-X.X badge, MUST pill, clean specification without redundant title prefix, nested deliverables, table, and Open Ch. CTA", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const node: WbsNode = {
      id: "f-2-2",
      type: "subfeature",
      title: "Pemindaian Area Ruang",
      priority: "Must-have",
      detail:
        "**Pemindaian Area Ruang**: Input foto/video singkat + dimensi ruangan pembeli.\n\n| Metric | Target |\n|---|---|\n| Latency | < 2s |",
      children: [
        { id: "f-2-2-1", type: "subfeature", title: "Guided capture foto", detail: "", children: [] },
        { id: "f-2-2-2", type: "subfeature", title: "Input dimensi ruang", detail: "", children: [] },
      ],
    };

    const onOpenDoc = vi.fn();
    const onAddNote = vi.fn();

    act(() => {
      root?.render(
        React.createElement(DetailPanel, {
          node,
          language: "id",
          breadcrumb: "PRD / Modul Discovery & AI / Pemindaian Area Ruang",
          chapterNumber: "04",
          onClose: vi.fn(),
          onOpenDocument: onOpenDoc,
          onAddNote,
        }),
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("WBS-2.2");
    expect(text).toContain("MUST");
    expect(text).toContain("Spesifikasi");
    expect(text).toContain("Input foto/video singkat + dimensi ruangan pembeli.");
    expect(text).toContain("Deliverable & Sub-item");
    expect(text).toContain("Guided capture foto");
    expect(text).toContain("Kriteria & Spesifikasi");
    expect(text).toContain("Latency");
    expect(text).toContain("Buka Bab 04");
    expect(text).toContain("Tambah catatan");
  });
});