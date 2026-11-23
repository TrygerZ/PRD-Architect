import { describe, it, expect } from "vitest";
import { detectTrailingTruncation } from "./truncation";

describe("shared/truncation - detectTrailingTruncation", () => {
  it("returns null for empty or cleanly terminated documents", () => {
    expect(detectTrailingTruncation("")).toBeNull();
    expect(detectTrailingTruncation("   \n  ")).toBeNull();
    expect(detectTrailingTruncation("## 1. Summary\n\nAll objectives defined.")).toBeNull();
    expect(detectTrailingTruncation("## 1. Summary\nBody 1\n\n## 2. Problem\nBody 2")).toBeNull();
    expect(detectTrailingTruncation("- Target rilis: Q3 2026")).toBeNull();
    expect(
      detectTrailingTruncation(
        "## 4. WBS\n- **Modul Studio**\n  - Konversi Video 3D\n    - Antrean rekonstruksi AI",
      ),
    ).toBeNull();
    expect(detectTrailingTruncation("## 1. Code\n```json\n{\"ok\": true}\n```")).toBeNull();
    expect(
      detectTrailingTruncation(
        "| Pertanyaan | Dampak | Deadline | Owner |\n|---|---|---|---|\n| Lisensi? | Tinggi | 2025-02-14 | Tech Lead |",
      ),
    ).toBeNull();
  });

  it("detects Gambar 1 mid-sentence list cut ending on Indonesian preposition", () => {
    const gambar1 = [
      "## 2. Definisi Masalah & Analisis Pasar",
      "",
      "4. Pencahayaan alami ruangan jarang dipertimbangkan; pembeli memilih furnitur berwarna gelap yang terlihat bagus di foto tetapi tampak muram di kamar kos dengan satu jendela kecil.",
      "5. Negosiasi harga dengan pengrajin terjadi di",
    ].join("\n");

    expect(detectTrailingTruncation(gambar1)).toEqual({ kind: "mid_sentence" });
  });

  it("detects Gambar 2 unclosed table row on the final chapter", () => {
    const gambar2 = [
      "## 13. Pertanyaan Terbuka",
      "",
      "| PERTANYAAN | DAMPAK JIKA TIDAK DIJAWAB | DEADLINE KEPUTUSAN | DECISION MAKER |",
      "|---|---|---|---|",
      "| Apakah lisensi Hunyuan3D-2 kompatibel? | Pipeline terhambat | 2025-02-14 | Tech Lead |",
      "| Apakah skema monetisasi Pay-per-Generation lewat QRIS memerlukan entitas badan",
    ].join("\n");

    expect(detectTrailingTruncation(gambar2)).toEqual({ kind: "unclosed_table_row" });
  });

  it("detects table row closed with pipe but missing columns compared to header", () => {
    const incompleteCols = [
      "| PERTANYAAN | DAMPAK | DEADLINE | DECISION MAKER |",
      "|---|---|---|---|",
      "| Apakah QRIS butuh entitas badan? |",
    ].join("\n");

    expect(detectTrailingTruncation(incompleteCols)).toEqual({ kind: "unclosed_table_row" });
  });

  it("detects table cut immediately after separator row", () => {
    const onlyHeader = "| A | B |\n|---|---|";
    expect(detectTrailingTruncation(onlyHeader)).toEqual({ kind: "unclosed_table_row" });
  });

  it("detects unclosed code fence (mermaid or json)", () => {
    const openFence = "## 6. Architecture\n```mermaid\nflowchart LR\n  A --> B";
    expect(detectTrailingTruncation(openFence)).toEqual({ kind: "unclosed_fence" });
  });

  it("detects empty trailing heading with no body", () => {
    expect(detectTrailingTruncation("## 1. Intro\nDone.\n\n## 2. Scope")).toEqual({
      kind: "empty_heading",
    });
    expect(detectTrailingTruncation("## 1. Intro\n### 1.1 Sub")).toEqual({
      kind: "empty_heading",
    });
  });

  it("detects unclosed bold, inline code, or markdown link", () => {
    expect(detectTrailingTruncation("Ensure **strict validation")).toEqual({
      kind: "unclosed_inline_syntax",
    });
    expect(detectTrailingTruncation("Call endpoint `POST /api/v1/orders")).toEqual({
      kind: "unclosed_inline_syntax",
    });
    expect(detectTrailingTruncation("See [Spec](https://example.com/prd")).toEqual({
      kind: "unclosed_inline_syntax",
    });
  });

  it("detects English mid-sentence list truncation via sibling consistency and dangling word", () => {
    const enCut = [
      "1. Merchant records a 10-second 360-degree product video.",
      "2. System displays generated thumbnail, 3D mesh preview, and AI-estimated",
    ].join("\n");

    expect(detectTrailingTruncation(enCut)).toEqual({ kind: "mid_sentence" });
  });
});
