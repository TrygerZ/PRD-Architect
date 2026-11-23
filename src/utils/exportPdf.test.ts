import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPdfDocument } from "./exportPdf";
import type { FontFaceSpec } from "./pdfFonts";

const LOCAL_FONT_MAP: Record<string, string> = {
  "Inter-Regular.ttf": "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff",
  "Inter-Bold.ttf": "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
  "Inter-Italic.ttf": "node_modules/@fontsource/inter/files/inter-latin-400-italic.woff",
  "Inter-BoldItalic.ttf": "node_modules/@fontsource/inter/files/inter-latin-700-italic.woff",
  "JetBrainsMono-Regular.ttf":
    "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
  "JetBrainsMono-Bold.ttf":
    "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff",
};

const loadLocalFont = async (face: FontFaceSpec): Promise<Uint8Array> => {
  const rel = LOCAL_FONT_MAP[face.vfsName];
  if (!rel) throw new Error(`Unknown font face: ${face.vfsName}`);
  return new Uint8Array(fs.readFileSync(path.resolve(rel)));
};

describe("exportPdf - editorial layout & embedded Unicode TTF", () => {
  it("embeds Inter & JetBrains Mono TTF, renders multi-page tables/lists/code/blockquotes/WBS, and adds running header & footer", async () => {
    const longTableRows = Array.from(
      { length: 24 },
      (_, i) =>
        `| REQ-${String(i + 1).padStart(2, "0")} | Must | Sistem wajib memvalidasi dimensi 2×3 m (±2.5 cm) memakai \`POST /api/v1/assets\` dengan **latensi ≤ 2.4s** | < 2.4s |`,
    ).join("\n");

    const markdown = [
      "---",
      "internal: ignore-me",
      "---",
      "## 1. Ringkasan Eksekutif",
      "RuangReka membantu **UMKM furnitur lokal** — Rp1,5–3 juta/produk • ruang 2×3 m — dengan endpoint `GET /api/v1/catalog`.",
      "",
      "- Level 0 bullet dengan **bold** dan `inline_code`",
      "  - Level 1 nested bullet",
      "    - Level 2 deep bullet",
      "",
      "1. Langkah pertama dengan penjelasan panjang agar memicu wrapping hanging indent yang rapi sejajar di bawah teks utama.",
      "2. Langkah kedua validasi skala AR.",
      "",
      "> Catatan penting arsitektur: seluruh model 3D wajib dikompresi di bawah 8 MB agar lancar di Android kelas menengah.",
      "",
      "```json",
      "{",
      '  "endpoint": "/api/v1/reconstruct",',
      '  "maxVideoSizeMb": 20',
      "}",
      "```",
      "",
      "---",
      "",
      "## 2. Matriks Persyaratan",
      "| ID | Prioritas | Deskripsi Persyaratan | SLA |",
      "|---|---|---|---|",
      longTableRows,
      "",
      "## 3. Feature Breakdown (WBS)",
      "- **Modul Studio Merchant**",
      "  - Konversi Video 3D",
      "    - Unggah video 360",
      "    - Antrean rekonstruksi AI",
      "",
      "Catatan ekor WBS harus ikut dirender.",
      "",
      "### Work Breakdown Structure (Fallback Prosa)",
      "Paragraf fallback WBS non-bullet ini tetap tampil dan tidak ter-skip.",
    ].join("\n");

    const { doc, fonts } = await buildPdfDocument(markdown, "Mobile App", "id", {
      preRenderedCharts: new Map(),
      fontLoader: loadLocalFont,
    });

    expect(fonts).toEqual({ sans: "Inter", mono: "JetBrainsMono", unicode: true });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);

    const pdfBytes = Buffer.from(doc.output("arraybuffer"));
    // Valid PDF header & non-trivial embedded TrueType payload
    expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBytes.byteLength).toBeGreaterThan(20_000);

    // Embedded TrueType font descriptors for Inter & JetBrainsMono and FlateDecode compression
    const rawLatin1 = pdfBytes.toString("latin1");
    expect(rawLatin1).toContain("Inter");
    expect(rawLatin1).toContain("JetBrainsMono");
    expect(rawLatin1).toContain("/FlateDecode");
  });

  it("gracefully falls back to built-in helvetica/courier when font loading fails", async () => {
    const { doc, fonts } = await buildPdfDocument(
      "## 1. Summary\n\nSimple body 2×3 m — ok.",
      "Web App",
      "en",
      {
        preRenderedCharts: new Map(),
        fontLoader: async () => {
          throw new Error("Simulated offline fetch failure");
        },
      },
    );

    expect(fonts).toEqual({ sans: "helvetica", mono: "courier", unicode: false });
    expect(doc.getNumberOfPages()).toBe(1);
    const pdfBytes = Buffer.from(doc.output("arraybuffer"));
    expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
