import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { woffToTtf, normalizePdfText, bytesToBase64 } from "./pdfFonts";

describe("pdfFonts - WOFF 1.0 to TrueType unpacker & text normalizer", () => {
  it("unpacks self-hosted @fontsource/inter and @fontsource/jetbrains-mono WOFF into valid TrueType sfnt", async () => {
    const files = [
      "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff",
      "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
    ];

    for (const rel of files) {
      const woff = new Uint8Array(fs.readFileSync(path.resolve(rel)));
      const ttf = await woffToTtf(woff);
      const view = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
      // Valid TrueType sfnt flavor 0x00010000
      expect(view.getUint32(0, false)).toBe(0x00010000);
      expect(view.getUint16(4, false)).toBeGreaterThanOrEqual(8);
      expect(bytesToBase64(ttf).length).toBeGreaterThan(10_000);
    }
  });

  it("rejects non-WOFF buffers cleanly", async () => {
    await expect(woffToTtf(new Uint8Array(10))).rejects.toThrow(/too short/i);
    await expect(woffToTtf(new Uint8Array(64))).rejects.toThrow(/Invalid WOFF signature/i);
  });

  it("preserves Latin-1 and typographic Unicode glyphs when unicode font is active", () => {
    const sample = "Kamar 2×3 m — Rp1,5–3 juta • ±2.5° ≤ 3s → OK 🚀";
    const out = normalizePdfText(sample, true);
    expect(out).toContain("2×3 m");
    expect(out).toContain("—");
    expect(out).toContain("–");
    expect(out).toContain("•");
    expect(out).toContain("±2.5°");
    // Out-of-subset math/arrow glyphs mapped cleanly without tofu boxes
    expect(out).toContain("<= 3s");
    expect(out).toContain("-> OK");
    // Unsupported emoji stripped
    expect(out).not.toContain("🚀");
  });

  it("normalizes to clean ASCII when falling back to built-in helvetica/courier", () => {
    const sample = "Kamar 2×3 m — Rp1,5–3 juta • ±2.5° ≤ 3s → OK";
    const out = normalizePdfText(sample, false);
    expect(out).toBe("Kamar 2x3 m - Rp1,5-3 juta * +/-2.5 deg <= 3s -> OK");
  });
});
