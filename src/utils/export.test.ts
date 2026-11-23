import { describe, it, expect } from "vitest";
import {
  parseInline,
  parseTableRow,
  inlineRunSpecs,
  layoutInline,
  isGfmSeparatorRow,
  isThematicBreak,
  collectTableBodyRows,
  richCellHeight,
  parseListLine,
  computeColumnWeights,
  computeMermaidDisplaySize,
  buildExportMeta,
} from "./export";
import type { InlineSeg } from "./export";

describe("parseInline (token gaya untuk sel tabel PDF)", () => {
  it("bold ** → seg bold", () => {
    expect(parseInline("Given **user is logged in**, then")).toEqual([
      { text: "Given " },
      { text: "user is logged in", bold: true },
      { text: ", then" },
    ]);
  });

  it("italic * dan code ` terpisah", () => {
    expect(parseInline("*retry* `GET /api`")).toEqual([
      { text: "retry", italic: true },
      { text: " " },
      { text: "GET /api", code: true },
    ]);
  });

  it("link [label](url) → label saja tanpa url", () => {
    expect(parseInline("[docs](https://x.y)")).toEqual([{ text: "docs" }]);
  });

  it("teks polos → satu segmen tanpa gaya", () => {
    expect(parseInline("plain")).toEqual([{ text: "plain" }]);
  });
});

describe("parseTableRow (sel mentah untuk rich-text export)", () => {
  it("marker inline TIDAK dibuang — jalur PDF/DOCX parse gaya sendiri", () => {
    expect(parseTableRow("| **Bold** | plain |")).toEqual(["**Bold**", "plain"]);
  });

  it("<br> di sel dinormalisasi jadi spasi (data lama)", () => {
    expect(parseTableRow("| Given A<br>When B<br/>Then C | x |")).toEqual([
      "Given A When B Then C",
      "x",
    ]);
  });

  it("jumlah kolom tetap benar walau sel mengandung gaya", () => {
    const row = parseTableRow("| `code` | *it* | mix **b** and *i* |");
    expect(row).toHaveLength(3);
    expect(row[2]).toBe("mix **b** and *i*");
  });
});

describe("inlineRunSpecs (spesifikasi TextRun DOCX)", () => {
  it("bold/italic/code dipetakan ke flag run", () => {
    expect(inlineRunSpecs("**B** *I* `C` plain")).toEqual([
      { text: "B", bold: true },
      { text: " " },
      { text: "I", italic: true },
      { text: " " },
      { text: "C", code: true },
      { text: " plain" },
    ]);
  });

  it("baseBold=true (header) mem-bold semua segmen", () => {
    expect(inlineRunSpecs("ID", true)).toEqual([{ text: "ID", bold: true }]);
    expect(inlineRunSpecs("**A** b", true)).toEqual([
      { text: "A", bold: true },
      { text: " b", bold: true },
    ]);
  });

  it("<br> dinormalisasi sebelum parse", () => {
    expect(inlineRunSpecs("A<br>B")).toEqual([{ text: "A B" }]);
  });
});

// --- Layout bersama (reservasi tinggi sel PDF ≡ penggambaran) ----------------

const lineTexts = (lines: ReturnType<typeof layoutInline>) =>
  lines.map((l) => l.map((t) => t.text).join(""));

describe("layoutInline (hitungan baris wrap — sumber tunggal utk ukur & gambar)", () => {
  const monospace = (t: string) => t.length;

  it("kata turun baris bila meluber sisa lebar", () => {
    const lines = layoutInline(parseInline("aaaa bbbb cccc"), 10, monospace);
    expect(lineTexts(lines)).toEqual(["aaaa bbbb ", "cccc"]);
  });

  it("spasi awal baris dibuang; spasi tinggal di baris lama saat kata berikutnya wrap", () => {
    expect(lineTexts(layoutInline(parseInline("  aaa"), 10, monospace))).toEqual(["aaa"]);
    expect(lineTexts(layoutInline(parseInline("aaa bbb"), 6, monospace))).toEqual(["aaa ", "bbb"]);
  });

  it("teks kosong → [] (tanpa tinta, tanpa perubahan y)", () => {
    expect(layoutInline(parseInline(""), 10, monospace)).toEqual([]);
    expect(layoutInline(parseInline("   "), 10, monospace)).toEqual([]);
  });

  it("default: kata > kolom TIDAK dipecah (perilaku prosa lama)", () => {
    expect(lineTexts(layoutInline(parseInline("abcdefghijkl"), 10, monospace))).toEqual(["abcdefghijkl"]);
  });

  it("breakLongWords: kata > kolom dipecah per karakter (menyamai autoTable)", () => {
    expect(lineTexts(layoutInline(parseInline("abcdefghijkl"), 10, monospace, true))).toEqual([
      "abcdefghij",
      "kl",
    ]);
  });

  it("pengukuran sadar-gaya: seg bold lebih lebar → wrap lebih awal", () => {
    const segs: InlineSeg[] = [{ text: "aa " }, { text: "bb", bold: true }];
    const styleAware = (t: string, s: InlineSeg) => t.length * (s.bold ? 2 : 1);
    // "aa "(3) + "bb"(4) = 7 > 5 → turun baris; tanpa sadar-gaya muat 1 baris.
    expect(layoutInline(segs, 5, styleAware)).toHaveLength(2);
    expect(layoutInline(segs, 5, monospace)).toHaveLength(1);
  });
});

describe("richCellHeight (kontrak reservasi tinggi sel rich-text)", () => {
  it("pad + nLines × fontSize × 1.4", () => {
    expect(richCellHeight(1, 9, 8)).toBe(20.6);
    expect(richCellHeight(5, 9, 8)).toBeCloseTo(71, 5);
  });

  it("regresi: 5 baris muat dalam border (kasus overflow +6.20pt)", () => {
    const n = 5;
    const fontSize = 9;
    const pad = 4;
    const height = richCellHeight(n, fontSize, pad * 2);
    // baseline terakhir + descent harus ≤ tinggi sel
    const lastBaseline = pad + (n - 1) * fontSize * 1.4 + fontSize * 1.05;
    const descent = fontSize * 0.23;
    expect(lastBaseline + descent).toBeLessThanOrEqual(height);
    // reservasi lama autoTable (59.75pt) tidak cukup
    expect(height).toBeGreaterThan(pad * 2 + n * fontSize * 1.15);
  });
});

// --- Guard baris separator (Bug B) -------------------------------------------

describe("isGfmSeparatorRow / isThematicBreak", () => {
  it("baris `| --- |` = separator GFM, baris data bukan", () => {
    expect(isGfmSeparatorRow("| --- | --- |")).toBe(true);
    expect(isGfmSeparatorRow("| :---: | --- |")).toBe(true);
    expect(isGfmSeparatorRow("| Given | When |")).toBe(false);
    expect(isGfmSeparatorRow("| - | x |")).toBe(false);
  });

  it("thematic break termasuk setext `===` bonus", () => {
    for (const s of ["---", "***", "___", "===", "=====", "  ---  "]) {
      expect(isThematicBreak(s)).toBe(true);
    }
    for (const s of ["--", "- item", "text", "**", "= =", "--- x"]) {
      expect(isThematicBreak(s)).toBe(false);
    }
  });

  it("CommonMark: 3+ karakter dan spasi di antara", () => {
    // Valid: lebih dari 3 karakter
    for (const s of ["----", "-----", "*****", "_____"]) {
      expect(isThematicBreak(s)).toBe(true);
    }
    // Valid: spasi di antara karakter
    for (const s of ["- - -", "* * *", "_ _ _", " - - - ", "  *  *  *  "]) {
      expect(isThematicBreak(s)).toBe(true);
    }
    // Invalid: kurang dari 3, atau ada karakter lain
    for (const s of ["- -", "-- -x", "--- text", "-_-"]) {
      expect(isThematicBreak(s)).toBe(false);
    }
  });
});

describe("collectTableBodyRows (collector body tabel PDF)", () => {
  it("separator GFM di tengah body di-skip, bukan data", () => {
    const { rows, endIdx } = collectTableBodyRows(
      ["| a | b |", "| --- | --- |", "| c | d |"],
      0,
    );
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(endIdx).toBe(3);
  });

  it("`---` standalone di antara baris tabel dikonsumsi — tabel tak terpotong", () => {
    const { rows, endIdx } = collectTableBodyRows(["| a |", "---", "| b |"], 0);
    expect(rows).toEqual([["a"], ["b"]]);
    expect(endIdx).toBe(3);
  });

  it("`---` standalone di akhir TIDAK dikonsumsi — tetap HR normal", () => {
    const { rows, endIdx } = collectTableBodyRows(["| a |", "---", "paragraf"], 0);
    expect(rows).toEqual([["a"]]);
    expect(endIdx).toBe(1);
  });

  it("berhenti di paragraf biasa", () => {
    const { rows, endIdx } = collectTableBodyRows(["| a |", "teks bebas", "| b |"], 0);
    expect(rows).toEqual([["a"]]);
    expect(endIdx).toBe(1);
  });
});

describe("parseListLine (nested bullet & ordered list depth)", () => {
  it("preserves indentation levels 0, 1, 2 for bullets and ordered lists", () => {
    expect(parseListLine("- Top item")).toEqual({
      kind: "bullet",
      level: 0,
      marker: "-",
      text: "Top item",
    });
    expect(parseListLine("  - Nested item")).toEqual({
      kind: "bullet",
      level: 1,
      marker: "-",
      text: "Nested item",
    });
    expect(parseListLine("    * Deep item")).toEqual({
      kind: "bullet",
      level: 2,
      marker: "*",
      text: "Deep item",
    });
    expect(parseListLine("  2. Sub step")).toEqual({
      kind: "ordered",
      level: 1,
      marker: "2.",
      text: "Sub step",
    });
    expect(parseListLine("Regular paragraph")).toBeNull();
  });
});

describe("computeColumnWeights (proportional table widths)", () => {
  it("gives compact columns less width and long description columns more width while summing exactly", () => {
    const header = ["ID", "Priority", "Feature Description", "SLA"];
    const rows = [
      ["F-01", "Must", "Pipeline AI mengubah video 360 derajat menjadi model 3D GLB/GLTF otomatis dalam 8 menit", "8m"],
      ["F-02", "Must", "Render model 3D skala 1:1 pada kamera dengan ground-plane snapping di ruang kos", "30fps"],
    ];
    const widths = computeColumnWeights(header, rows, 500, 45);
    expect(widths).toHaveLength(4);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(500);
    // Description column (index 2) must be significantly wider than ID (index 0)
    expect(widths[2]).toBeGreaterThan(widths[0] * 1.8);
    expect(widths.every((w) => w >= 45)).toBe(true);
  });
});

describe("computeMermaidDisplaySize (no excessive upscale)", () => {
  it("does not stretch small diagrams beyond maxScale", () => {
    const size = computeMermaidDisplaySize(220, 120, 550, 680, 1.15);
    expect(size.width).toBe(253);
    expect(size.height).toBe(138);
  });

  it("scales large diagrams down proportionally within bounds", () => {
    const size = computeMermaidDisplaySize(1200, 600, 500, 700, 1.15);
    expect(size.width).toBe(500);
    expect(size.height).toBe(250);
  });
});

describe("layoutInline continuationWidth (hanging indent wrap)", () => {
  it("wraps continuation lines at narrower width without overflowing right margin", () => {
    const monospace = (t: string) => t.length;
    const lines = layoutInline(
      parseInline("aaaa bbbb cccc dddd"),
      10,
      monospace,
      false,
      6,
    );
    expect(lineTexts(lines)).toEqual(["aaaa bbbb ", "cccc ", "dddd"]);
  });
});

describe("buildExportMeta", () => {
  it("builds localized metadata with chapter count and product type", () => {
    const meta = buildExportMeta(
      "## 1. Ringkasan\nIsi.\n\n## 2. Masalah\nIsi.",
      "Mobile App",
      "id",
      new Date("2026-11-23T12:00:00Z"),
    );
    expect(meta.title).toContain("Mobile App");
    expect(meta.chapterCount).toBe(2);
    expect(meta.subtitle).toContain("2 Bab");
  });
});
