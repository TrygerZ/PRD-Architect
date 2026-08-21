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
