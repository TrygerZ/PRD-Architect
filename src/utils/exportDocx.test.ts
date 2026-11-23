import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { Packer } from "docx";
import { buildDocxDocument } from "./exportDocx";

/** Minimal ZIP entry extractor using built-in node:zlib for verifying real OOXML output. */
function readZipEntries(buf: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  let offset = 0;
  while (offset + 30 <= buf.length && buf.readUInt32LE(offset) === 0x04034b50) {
    const compression = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    if (name.endsWith(".xml")) {
      const text =
        compression === 8
          ? zlib.inflateRawSync(raw).toString("utf8")
          : raw.toString("utf8");
      files[name] = text;
    }
    offset = dataStart + compSize;
  }
  return files;
}

describe("exportDocx OOXML structure & editorial styling", () => {
  it("preserves inline bold/code in paragraphs, resets ordered lists, sets proportional columnWidths, keepNext, cantSplit, HR, and WBS fallback", async () => {
    const markdown = [
      "---",
      "author: test",
      "---",
      "## 1. Executive Summary",
      "Target **UMKM lokal** memakai endpoint `POST /api/v1/assets` dengan ukuran 2×3 m.",
      "",
      "- Top bullet with **bold**",
      "  - Nested bullet level 1",
      "    - Deep bullet level 2",
      "",
      "1. First list item one",
      "2. First list item two",
      "",
      "---",
      "",
      "## 2. Feature Matrix",
      "| ID | Prioritas | Deskripsi Lengkap Fitur |",
      "|---|---|---|",
      "| F-01 | Must | Konversi video 360 derajat berdurasi 10 detik menjadi aset 3D GLB/GLTF otomatis |",
      "| F-02 | Should | Rekomendasi interior dengan `Qwen` berbasis pencahayaan alami kamar kos |",
      "",
      "1. Second list restarts numbering",
      "",
      "> Catatan penting: **toleransi skala** maksimal ±2.5 cm.",
      "",
      "```json",
      '{ "status": "ok" }',
      "```",
      "",
      "### Work Breakdown Structure (WBS)",
      "Konten prosa WBS fallback ini TIDAK boleh hilang walau tanpa bullet.",
    ].join("\n");

    const doc = await buildDocxDocument(markdown, "Mobile App", "id", new Map());
    const buf = await Packer.toBuffer(doc);
    const xmlFiles = readZipEntries(buf);

    const docXml = xmlFiles["word/document.xml"];
    expect(docXml).toBeTruthy();

    // YAML frontmatter stripped & cover header present
    expect(docXml).not.toContain("author: test");
    expect(docXml).toContain("DOKUMEN SPESIFIKASI PRODUK (PRD)");
    expect(docXml).toContain("Mobile App");

    // Inline bold & Consolas monospace preserved inside normal paragraphs/lists (not stripped)
    expect(docXml).toContain("UMKM lokal");
    expect(docXml).toContain("POST /api/v1/assets");
    expect(docXml).toContain("Consolas");

    // Headings have keepNext to prevent orphan headings
    expect(docXml).toContain("<w:keepNext/>");

    // Tables use cantSplit per row and proportional (non-equal) gridCol widths
    expect(docXml).toContain("<w:cantSplit/>");
    const gridCols = Array.from(docXml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)).map((m) =>
      Number(m[1]),
    );
    expect(gridCols).toHaveLength(3);
    // Description column (3rd) must be much wider than ID column (1st)
    expect(gridCols[2]).toBeGreaterThan(gridCols[0] * 1.8);

    // Nested bullet levels preserved (ilvl 0, 1, 2)
    expect(docXml).toContain('w:ilvl w:val="1"');
    expect(docXml).toContain('w:ilvl w:val="2"');

    // Ordered list restarted across separate lists (2 distinct numId assignments)
    const numXml = xmlFiles["word/numbering.xml"] ?? "";
    expect(numXml.length).toBeGreaterThan(0);

    // Thematic break `---` is rendered as border rule, NOT literal text "---"
    expect(docXml).not.toContain(">---<");

    // WBS fallback regression: non-bullet prose under WBS heading must NOT be dropped!
    expect(docXml).toContain("Konten prosa WBS fallback ini TIDAK boleh hilang");

    // Running footer contains dynamic PAGE / NUMPAGES fields
    const footerContent = Object.entries(xmlFiles)
      .filter(([k]) => k.startsWith("word/footer"))
      .map(([, v]) => v)
      .join("\n");
    expect(footerContent).toContain("PRD Architect");
    expect(footerContent).toContain("PAGE");
    expect(footerContent).toContain("NUMPAGES");
  });
});
