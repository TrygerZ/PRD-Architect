// Task 3.1 — Export PRD ke DOCX, PDF, dan JSON terstruktur.
// Lazy-import lib berat (docx, jspdf, jspdf-autotable, mermaid) hanya saat dipakai.
// Mermaid diagram dirender ke PNG (SVG → canvas → dataURL) lalu disisipkan sebagai gambar.
import DOMPurify from "dompurify";
import { getSections, type Section } from "./sections";
import { sanitizeMermaid } from "./mermaid";
import { normalizeBrTags } from "./format";
import { parseBulletTree } from "./wbs";
import { WBS_SECTION_RE, wbsRows, wbsTableRows, wbsTailNote } from "./wbsTable";

// Ambil token bahasa pertama dari info-string fenced code block.
// AI sering menulis fence seperti "```mermaid journey", "```mermaid gantt",
// "```mermaid graph TD" — token pertama ("mermaid") yang menentukan jenis blok,
// sisanya hanyalah metadata diagram. Live renderer (react-markdown) juga hanya
// memakai kata pertama sebagai `language-*`, jadi export harus konsisten.
function fenceLang(fenceLine: string): string {
  return fenceLine
    .trim()
    .replace(/^```+/, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)[0] || "";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Markdown inline helpers -------------------------------------------------

function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1");
}

/**
 * Normalisasi teks ke ASCII yang bisa dirender jsPDF dengan font standar
 * (helvetica/courier = StandardEncoding). Tanpa ini, karakter non-ASCII
 * di-render sebagai byte mentah UTF-16 → box-drawing (U+25xx) muncul sebagai
 * "%" (byte tinggi 0x25 = '%'), dan •/—/curly quotes hilang sama sekali.
 *
 * Box-drawing (tree art hierarchy ├ │ └ ─) dipetakan ke ASCII line art
 * (+ - |) sehingga hierarki tetap tampil sebagai garis yang benar.
 */
function normalizePdfText(s: string): string {
  return s
    // ─ ━ ─ garis horizontal → '-'
    .replace(/[\u2500\u2501\u2504\u2505\u2506\u2507\u2508\u2509\u250A\u250B\u254C\u254D]/g, "-")
    // │ ┃ garis vertikal → '|'
    .replace(/[\u2502\u2503\u2507\u250E\u250F\u254E\u254F]/g, "|")
    // sudut & tee (┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ dsb) → '+'
    .replace(/[\u250C\u250D\u2510\u2511\u2514\u2515\u2518\u2519\u251C\u251D\u251E\u251F\u2520\u2521\u2522\u2523\u2524\u2525\u2526\u2527\u2528\u2529\u252A\u252B\u252C\u252D\u252E\u252F\u2530\u2531\u2532\u2533\u2534\u2535\u2536\u2537\u2538\u2539\u253A\u253B\u253C\u253D\u253E\u253F\u2540\u2541\u2542\u2543\u2544\u2545\u2546\u2547\u2548\u2549\u254A\u254B]/g, "+")
    // garis ganda ═ ║
    .replace(/\u2550/g, "=")
    .replace(/\u2551/g, "|")
    // bullet • ◉ ◯ → '*' (bullet list)
    .replace(/[\u2022\u25CF\u25CB]/g, "*")
    // dash – — → '-'
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...") // … ellipsis
    // curly quotes → lurus
    .replace(/[\u2018\u2019\u201A\u2032\u02B9]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033\u02BA]/g, '"')
    // panah
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2191/g, "^")
    .replace(/\u2193/g, "v")
    .replace(/\u21D2/g, "=>")
    .replace(/\u21D0/g, "<=")
    // simbol umum
    .replace(/\u00A0/g, " ")            // nbsp
    .replace(/\u00B0/g, " deg")         // °
    .replace(/\u00B1/g, "+/-")          // ±
    .replace(/\u00D7/g, "x")            // ×
    .replace(/\u00F7/g, "/")            // ÷
    .replace(/\u2264/g, "<=")           // ≤
    .replace(/\u2265/g, ">=")           // ≥
    .replace(/\u2260/g, "!=")           // ≠
    .replace(/\u2248/g, "~=")           // ≈
    .replace(/\u20AC/g, "EUR")          // €
    .replace(/\u00A9/g, "(c)")          // ©
    .replace(/\u00AE/g, "(R)")          // ®
    .replace(/\u2122/g, "TM")           // ™
    // Safety net: buang sisa char non-ASCII (0x80-0xFF juga tidak dirender
    // helvetica StandardEncoding) agar tidak muncul byte mentah / "%".
    .replace(/[^\x20-\x7E\r\n\t]/g, "");
}

// Segment teks dengan gaya inline (dipakai renderer PDF rich-text).
// Mendukung: **bold**, *italic*, `code`, [link](url). Urutan pengecekan
// ** sebelum * penting agar tidak salah-token.
export interface InlineSeg {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export function parseInline(text: string): InlineSeg[] {
  const segs: InlineSeg[] = [];
  const push = (t: string, s: Partial<InlineSeg> = {}) => {
    if (t) segs.push({ text: t, ...s });
  };
  let i = 0;
  while (i < text.length) {
    // **bold**
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        push(text.slice(i + 2, end), { bold: true });
        i = end + 2;
        continue;
      }
    }
    // *italic*
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        push(text.slice(i + 1, end), { italic: true });
        i = end + 1;
        continue;
      }
    }
    // `code`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        push(text.slice(i + 1, end), { code: true });
        i = end + 1;
        continue;
      }
    }
    // [text](url) — tampilkan label saja
    if (text[i] === "[") {
      const close = text.indexOf("]", i + 1);
      if (close !== -1 && text[close + 1] === "(") {
        const urlEnd = text.indexOf(")", close + 2);
        if (urlEnd !== -1) {
          push(text.slice(i + 1, close));
          i = urlEnd + 1;
          continue;
        }
      }
    }
    // Akumulasi teks biasa sampai karakter spesial berikutnya.
    let j = i;
    while (j < text.length && text[j] !== "*" && text[j] !== "`" && text[j] !== "[") j++;
    if (j === i) j++; // maju minimal 1 jika char spesial tak ter-match
    push(text.slice(i, j));
    i = j;
  }
  return segs;
}

// Spesifikasi run DOCX hasil parse inline — dipisah dari TextRun agar bisa
// dites di environment node tanpa mengimpor lib docx secara statis.
export interface RunSpec {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export function inlineRunSpecs(text: string, baseBold = false): RunSpec[] {
  return parseInline(normalizeBrTags(text)).map((seg) => ({
    text: seg.text,
    ...(baseBold || seg.bold ? { bold: true } : {}),
    ...(seg.italic ? { italic: true } : {}),
    ...(seg.code ? { code: true } : {}),
  }));
}

interface ParsedTable {
  header: string[];
  rows: string[][];
}

// Sel tabel dipertahankan MENTAH (marker ** * ` [link](url) tetap ada) agar
// jalur PDF/DOCX bisa mem-parse gaya inline per sel. <br> dari data lama
// dinormalisasi di titik parse ini (defense-in-depth di samping ingestion).
export function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => normalizeBrTags(c.trim()));
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(line) && line.includes("-");
}

// Thematic break Markdown (--- / *** / ___) plus underline setext `===` yang
// sering bocor dari AI sebagai baris literal di tengah dokumen.
// CommonMark: 3+ karakter yang sama (- * _), boleh spasi di antara, tak ada
// karakter lain. Setext `===` juga ditangani.
export function isThematicBreak(line: string): boolean {
  const t = line.trim();
  // Hapus spasi internal lalu cek 3+ karakter identik
  const collapsed = t.replace(/ /g, "");
  return /^(-{3,}|\*{3,}|_{3,}|={3,})$/.test(collapsed);
}

// Baris separator GFM (`| --- | :---: |`) yang muncul DI TENGAH body tabel —
// itu bukan data dan tidak boleh digambar sebagai sel.
export function isGfmSeparatorRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && /^[\s|:\-]+$/.test(t);
}

/**
 * Kumpulkan baris body tabel mulai dari startIdx sampai baris non-tabel.
 * - Baris separator GFM di tengah body di-skip (tidak jadi sel literal).
 * - Thematic break standalone DI ANTARA dua baris `|...|` dikonsumsi agar
 *   tabel tidak terpotong (yang mempromosikan baris berikut jadi header palsu).
 *   Bila baris berikutnya bukan `|`, break — caller memperlakukannya sebagai HR.
 */
export function collectTableBodyRows(lines: string[], startIdx: number): { rows: string[][]; endIdx: number } {
  const rows: string[][] = [];
  let i = startIdx;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t.startsWith("|")) {
      if (isThematicBreak(t) && lines[i + 1]?.trim().startsWith("|")) {
        i++;
        continue;
      }
      break;
    }
    if (isGfmSeparatorRow(t)) {
      i++;
      continue;
    }
    rows.push(parseTableRow(lines[i]));
    i++;
  }
  return { rows, endIdx: i };
}

// Pemilihan font jsPDF untuk satu segmen inline — dipakai bersama oleh
// pengukuran layout & penggambaran agar keduanya identik.
function fontStyleFor(seg: InlineSeg, baseBold: boolean, baseItalic: boolean): [string, string] {
  const bold = baseBold || !!seg.bold;
  const italic = baseItalic || !!seg.italic;
  return [
    seg.code ? "courier" : "helvetica",
    bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal",
  ];
}

interface LayoutToken {
  text: string;
  seg: InlineSeg;
  space: boolean;
}

/**
 * Layout word-wrap rich-text — SATU-SATUNYA sumber kebenaran untuk hitungan
 * baris, dipakai baik saat menggambar (writeRichText) maupun saat reservasi
 * tinggi sel (didParseCell), sehingga ukur dan gambar tak mungkin divergen.
 *
 * Logika wrap identik dgn penggambaran manual lama: spasi awal baris dibuang,
 * kata turun baris bila meluber, spasi yang jatuh di ujung baris terbuang.
 * `breakLongWords` (mode sel): kata lebih lebar dari kolom dipecah per
 * karakter — menyamai perilaku overflow:"linebreak" autoTable.
 *
 * `measure` di-inject (bukan fontSize) agar testable tanpa jsPDF: test bisa
 * memakai pengukur palsu deterministik. Mengembalikan [] utk teks kosong.
 */
export function layoutInline(
  segs: InlineSeg[],
  availWidth: number,
  measure: (text: string, seg: InlineSeg) => number,
  breakLongWords = false,
): LayoutToken[][] {
  const tokens: LayoutToken[] = [];
  for (const seg of segs) {
    for (const part of seg.text.split(/(\s+)/)) {
      if (part === "") continue;
      tokens.push({ text: part, seg, space: /^\s+$/.test(part) });
    }
  }

  const lines: LayoutToken[][] = [];
  let line: LayoutToken[] = [];
  let x = 0;
  let hasContent = false;
  const newLine = () => {
    lines.push(line);
    line = [];
    x = 0;
    hasContent = false;
  };

  for (const tok of tokens) {
    const w = measure(tok.text, tok.seg);
    if (tok.space) {
      if (!hasContent) continue; // buang spasi di awal baris
      if (x + w > availWidth) newLine(); // spasi di ujung baris terbuang
      else {
        line.push(tok);
        x += w;
      }
      continue;
    }
    if (hasContent && x + w > availWidth) newLine();
    if (breakLongWords && w > availWidth) {
      let chunk = "";
      for (const ch of tok.text) {
        if (chunk !== "" && x + measure(chunk + ch, tok.seg) > availWidth) {
          line.push({ text: chunk, seg: tok.seg, space: false });
          newLine();
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk !== "") {
        line.push({ text: chunk, seg: tok.seg, space: false });
        x += measure(chunk, tok.seg);
        hasContent = true;
      }
      continue;
    }
    line.push(tok);
    x += w;
    hasContent = true;
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

// Tinggi sel rich-text: pad vertikal + nLines × lineHeight (1.4×).
// Kontrak bersama reservasi (didParseCell) & baseline penggambaran
// (fontSize*1.05 utk baris pertama, lalu step 1.4×) — jangan diubah sendiri-sendiri.
export function richCellHeight(nLines: number, fontSize: number, padVertical: number): number {
  return padVertical + nLines * fontSize * 1.4;
}

// --- WBS section (render sebagai tabel ber-rowSpan di PDF/DOCX) --------------

// Kumpulkan blok baris di bawah heading WBS sampai heading level ≤ level-nya
// atau EOF — pola sama dengan parseBreakdown di utils/wbs.ts.
function collectWbsBlock(lines: string[], startIdx: number, level: number): { endIdx: number; block: string } {
  const block: string[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= level) break;
    block.push(lines[i]);
    i++;
  }
  return { endIdx: i, block: block.join("\n") };
}

// Header kolom tabel WBS mengikuti bahasa dokumen.
function wbsHeaders(language: "id" | "en"): string[] {
  return language === "en" ? ["Module", "Feature", "Sub-feature"] : ["Modul", "Fitur", "Sub-fitur"];
}

// --- Mermaid → PNG helpers ---------------------------------------------------

interface PngResult {
  dataUrl: string;
  width: number;
  height: number;
}

// Konfigurasi dark theme yang dipakai MermaidRenderer.tsx — harus cocok agar
// restore setelah export tidak mengubah tampilan live.
const DARK_THEME_CONFIG = {
  startOnLoad: false,
  theme: "dark" as const,
  fontFamily: "Geist Mono",
  securityLevel: "loose" as const,
  themeVariables: {
    primaryColor: "#1e1e2e",
    primaryTextColor: "#cdd6f4",
  },
};

// htmlLabels: false → mermaid memakai elemen SVG <text> alih-alih <foreignObject>
// (HTML). foreignObject TIDAK ikut terender saat SVG digambar ke <canvas>,
// sehingga gambar PNG jadi kosong/gagal. Mematikannya membuat rasterisasi
// PNG untuk export selalu berhasil.
const LIGHT_THEME_CONFIG = {
  startOnLoad: false,
  theme: "default" as const,
  fontFamily: "Geist Mono",
  securityLevel: "strict" as const,
  htmlLabels: false,
  flowchart: { htmlLabels: false },
};

/**
 * Sementara beralih mermaid ke tema terang (untuk dokumen white-background),
 * jalankan fn, lalu restore tema dark. Memakai try/finally agar restore
 * selalu terjadi meski fn throw.
 */
async function withLightMermaid<T>(fn: () => Promise<T>): Promise<T> {
  const mermaidMod = await import("mermaid");
  const mermaid = mermaidMod.default;
  mermaid.initialize(LIGHT_THEME_CONFIG);
  try {
    return await fn();
  } finally {
    mermaid.initialize(DARK_THEME_CONFIG);
  }
}

/**
 * Render satu diagram mermaid ke PNG dataURL.
 * Mengembalikan null jika parse/render gagal — caller fallback ke kode teks.
 */
async function renderMermaidToPng(chart: string): Promise<PngResult | null> {
  const mermaidMod = await import("mermaid");
  const mermaid = mermaidMod.default;
  const id = `export-mermaid-${Math.random().toString(36).slice(2, 11)}`;
  // mermaid.render() tanpa argumen container menyisipkan <div> in-flow
  // (width:100%) langsung ke document.body. Div itu bertinggi riil sebesar
  // diagram, sehingga scrollHeight dokumen melonjak sesaat → scrollbar
  // memanjang → viewport bergeser = layar "bergetar" tiap kali export.
  // Solusi: sediakan container off-screen position:fixed (terpisah dari flow
  // dokumen) sebagai argumen ke-3 render() agar layout halaman tak berubah.
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-99999px;top:0;width:auto;height:auto;overflow:hidden;pointer-events:none;z-index:-1;opacity:0;";
  document.body.appendChild(host);
  try {
    // Auto-fix syntax AI yang sering invalid (parens/commas tak di-quote),
    // lalu normalisasi — sama persis dengan MermaidRenderer agar diagram yang
    // tampil di layar juga berhasil dirender ke gambar saat export.
    const normalized = sanitizeMermaid(chart)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "\n");
    await mermaid.parse(normalized);
    const { svg } = await mermaid.render(id, normalized, host);
    const sanitized = DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "iframe", "object", "embed"],
    });
    return await svgToPng(sanitized);
  } catch (err) {
    console.warn("Mermaid render for export failed:", err);
    return null;
  } finally {
    host.remove();
  }
}

/**
 * Ekstrak dimensi piksel intrinsik dari <svg>.
 * Mermaid v11 sering menulis width="100%" (bukan piksel) — parseFloat("100%")
 * menghasilkan 100, yang membuat canvas salah rasio (gambar jadi kecil &
 * tidak proporsional). Prioritas: atribut width/height numerik → viewBox →
 * max-width dari style → fallback.
 */
function extractMermaidCharts(markdown: string): string[] {
  const lines = markdown.split("\n");
  const charts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```") && fenceLang(trimmed) === "mermaid") {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      charts.push(codeLines.join("\n"));
    }
  }
  return charts;
}

function extractSvgDimensions(svgEl: SVGSVGElement): { width: number; height: number } {
  const wAttr = svgEl.getAttribute("width") || "";
  const hAttr = svgEl.getAttribute("height") || "";

  // Hanya terima atribut yang berupa angka piksel murni; tolak "100%"/"auto"/ds.
  let width = /^\d+(\.\d+)?$/.test(wAttr.trim()) ? parseFloat(wAttr) : NaN;
  let height = /^\d+(\.\d+)?$/.test(hAttr.trim()) ? parseFloat(hAttr) : NaN;

  // viewBox: "min-x min-y width height" → pakai width/height-nya.
  if (!width || !height) {
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(parseFloat);
      const vbW = parts[2];
      const vbH = parts[3];
      if (!width && Number.isFinite(vbW) && vbW > 0) width = vbW;
      if (!height && Number.isFinite(vbH) && vbH > 0) height = vbH;
    }
  }

  // Fallback terakhir: max-width dari inline style (mis. "max-width: 1234px").
  if (!width) {
    const style = svgEl.getAttribute("style") || "";
    const m = style.match(/max-width:\s*([\d.]+)\s*px/i);
    if (m) width = parseFloat(m[1]);
  }

  if (!width || width <= 0) width = 800;
  if (!height || height <= 0) height = 600;
  return { width, height };
}

/**
 * Konversi SVG string → PNG dataURL via canvas.
 * Memastikan SVG punya width/height eksplisit & rasio benar. Background diisi
 * putih agar terbaca di dokumen terang.
 */
async function svgToPng(svg: string): Promise<PngResult> {
  return new Promise((resolve, reject) => {
    // Parse & pastikan dimensi eksplisit
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgEl = svgDoc.querySelector("svg");
    if (!svgEl) {
      reject(new Error("Invalid SVG: no <svg> element"));
      return;
    }

    const { width, height } = extractSvgDimensions(svgEl);

    // Paksa dimensi piksel eksplisit + preserveAspectRatio default (xMidYMid
    // meet) agar gambar tidak ter-stretch bila viewBox ratio sedikit beda.
    svgEl.setAttribute("width", String(width));
    svgEl.setAttribute("height", String(height));
    if (!svgEl.getAttribute("preserveAspectRatio")) {
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    // Hilangkan constraint max-width yang bisa mencegah render full-size.
    svgEl.style.removeProperty("max-width");
    svgEl.style.maxWidth = String(width) + "px";

    const serializer = new XMLSerializer();
    const fixedSvg = serializer.serializeToString(svgEl);

    const blob = new Blob([fixedSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2; // 2x untuk ketajaman
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      // Background putih — mermaid SVG punya background transparan
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width, // dimensi tampilan (unscaled) untuk layout
        height,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG into Image"));
    };
    img.src = url;
  });
}

// --- DOCX --------------------------------------------------------------------

export async function exportDocx(content: string, productType: string, language: "id" | "en" = "id"): Promise<void> {
  const charts = extractMermaidCharts(content);
  const chartImageMap = new Map<string, PngResult | null>();
  if (charts.length > 0) {
    await withLightMermaid(async () => {
      const results = await Promise.all(charts.map((c) => renderMermaidToPng(c)));
      charts.forEach((c, idx) => {
        chartImageMap.set(c, results[idx]);
      });
    });
  }
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ImageRun,
    AlignmentType,
    VerticalAlign,
    TableLayoutType,
    ShadingType,
    BorderStyle,
  } = docx;

  // --- DOCX breathing space — padding sel yang nyaman (twips = 1/20 pt)
  // 80 = 4pt vertikal, 120 = 6pt horizontal. Jauh lebih lega dari default docx
  // yang rapat, tapi tetap hemat kertas.
  const DOCX_CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };
  const DOCX_HEADER_SHADING = { type: ShadingType.SOLID, fill: "F2F2F2", color: "auto" } as const;
  const DOCX_TABLE_BORDERS = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  };

  type DocChild = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: DocChild[] = [];
  const lines = content.split("\n");

  const headingLevelFor = (depth: number) => {
    switch (depth) {
      case 1:
        return HeadingLevel.HEADING_1;
      case 2:
        return HeadingLevel.HEADING_2;
      case 3:
        return HeadingLevel.HEADING_3;
      default:
        return HeadingLevel.HEADING_4;
    }
  };

  // Kode blok sebagai paragraph monospace (fallback untuk non-mermaid / render gagal)
  const makeCodeParagraph = (codeLines: string[]) =>
    new Paragraph({
      children: codeLines.map(
        (cl, idx) =>
          new TextRun({
            text: cl,
            font: "Consolas",
            size: 18,
            break: idx > 0 ? 1 : undefined,
          }),
      ),
      shading: { type: docx.ShadingType.SOLID, color: "F4F4F5", fill: "F4F4F5" },
      spacing: { after: 120 },
    });

  await withLightMermaid(async () => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Code fence — deteksi bahasa (mermaid vs lain)
      if (trimmed.startsWith("```")) {
        const lang = fenceLang(trimmed);
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }

        if (lang === "mermaid") {
          const chartCode = codeLines.join("\n");
          const png = chartImageMap.get(chartCode) ?? (await renderMermaidToPng(chartCode));
          if (png) {
            // Skala agar memenuhi lebar konten DOCX (~550px dgn margin default),
            // BOLEH upscale bila diagram sumber lebih kecil. Tinggi dibatasi
            // agar satu gambar tidak melebihi ~satu halaman (mencegah gambar
            // raksasa). Rasio aspek selalu dipertahankan.
            const maxW = 550;
            const maxH = 720;
            let scale = maxW / png.width;
            if (png.height * scale > maxH) scale = maxH / png.height;
            const dispW = Math.round(png.width * scale);
            const dispH = Math.round(png.height * scale);
            const base64 = png.dataUrl.split(",")[1];
            const imageBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "png",
                    data: imageBytes,
                    transformation: { width: dispW, height: dispH },
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 160, after: 160 },
              }),
            );
          } else {
            // Fallback: tampilkan kode mentah jika render gagal
            children.push(makeCodeParagraph(codeLines));
          }
        } else {
          children.push(makeCodeParagraph(codeLines));
        }
        continue;
      }

      // Tabel — render sebagai Table native docx
      if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const table: ParsedTable = { header: parseTableRow(line), rows: [] };
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          table.rows.push(parseTableRow(lines[i]));
          i++;
        }
        i--;

        // Sel DOCX mempertahankan gaya inline (**bold**, *italic*, `code`)
        // via array TextRun — setara pola heading rich-text di bawah.
        // Paragraph diberi spacing kecil + cell diberi margins & verticalAlign
        // agar tidak mepet; header diberi shading agar distinct.
        const makeRuns = (text: string, baseBold: boolean) =>
          inlineRunSpecs(text, baseBold).map(
            (spec) =>
              new TextRun({
                text: spec.text,
                ...(spec.bold ? { bold: true } : {}),
                ...(spec.italic ? { italics: true } : {}),
                ...(spec.code ? { font: "Consolas" } : {}),
                size: 20,
              }),
          );

        const makeCell = (text: string, bold: boolean) =>
          new TableCell({
            children: [
              new Paragraph({
                children: makeRuns(text, bold),
                spacing: { before: 20, after: 20 },
                alignment: AlignmentType.LEFT,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: DOCX_CELL_MARGINS,
            shading: bold ? DOCX_HEADER_SHADING : undefined,
          });

        const docRows = [
          new TableRow({ children: table.header.map((h) => makeCell(h, true)), tableHeader: true }),
          ...table.rows.map(
            (r) =>
              new TableRow({
                children: table.header.map((_, ci) => makeCell(r[ci] ?? "", false)),
              }),
          ),
        ];

        children.push(
          new Table({
            rows: docRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: DOCX_TABLE_BORDERS,
          }),
        );
        children.push(new Paragraph({ text: "" }));
        continue;
      }

      // Heading
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        children.push(
          new Paragraph({
            heading: headingLevelFor(headingMatch[1].length),
            children: [new TextRun({ text: stripInline(headingMatch[2]) })],
            spacing: { before: 200, after: 100 },
          }),
        );

        // Section WBS: bullet di bawah heading ini dirender sebagai tabel
        // ber-rowSpan (Modul/Fitur/Sub-fitur), bukan bullet bersarang.
        if (headingMatch[1].length <= 4 && WBS_SECTION_RE.test(headingMatch[2])) {
          const { endIdx, block } = collectWbsBlock(lines, i + 1, headingMatch[1].length);
          i = endIdx - 1; // loop akan i++ lagi; fallback (tanpa bullet) → baris diproses normal
          const items = parseBulletTree(block);
          if (items.length > 0) {
            const makeWbsCell = (text: string, bold: boolean, rowSpan?: number, isHeader = false) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text, bold, size: 20 })],
                    spacing: { before: 20, after: 20 },
                    alignment: AlignmentType.LEFT,
                  }),
                ],
                verticalAlign: VerticalAlign.CENTER,
                margins: DOCX_CELL_MARGINS,
                shading: isHeader ? DOCX_HEADER_SHADING : undefined,
                ...(rowSpan && rowSpan > 1 ? { rowSpan } : {}),
              });

            const docRows = [
              new TableRow({
                children: wbsHeaders(language).map((h) => makeWbsCell(h, true, undefined, true)),
                tableHeader: true,
              }),
              ...wbsTableRows(wbsRows(items)).map((r) => {
                const cells: InstanceType<typeof TableCell>[] = [];
                if (r.module !== null) cells.push(makeWbsCell(r.module, true, r.moduleSpan));
                if (r.feature !== null) cells.push(makeWbsCell(r.feature, false, r.featureSpan));
                cells.push(makeWbsCell(r.sub, false));
                return new TableRow({ children: cells });
              }),
            ];

            children.push(
              new Table({
                rows: docRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                layout: TableLayoutType.FIXED,
                borders: DOCX_TABLE_BORDERS,
              }),
            );
            children.push(new Paragraph({ text: "" }));

            // Tail note (prosa setelah blok bullet) — tidak boleh hilang.
            for (const tl of wbsTailNote(block).split("\n")) {
              if (!tl.trim()) continue;
              children.push(
                new Paragraph({
                  children: [new TextRun({ text: stripInline(tl), size: 22 })],
                  spacing: { after: 80 },
                }),
              );
            }
            continue;
          }
        }
        continue;
      }

      // List item
      const listMatch = trimmed.match(/^[-*+]\s+(.*)/);
      if (listMatch) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: stripInline(listMatch[1]), size: 22 })],
            bullet: { level: 0 },
          }),
        );
        continue;
      }
      const orderedMatch = trimmed.match(/^\d+\.\s+(.*)/);
      if (orderedMatch) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: stripInline(orderedMatch[1]), size: 22 })],
            numbering: { reference: "prd-numbering", level: 0 },
          }),
        );
        continue;
      }

      // Blockquote
      const quoteMatch = trimmed.match(/^>\s?(.*)/);
      if (quoteMatch) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: stripInline(quoteMatch[1]), italics: true, size: 22 })],
            indent: { left: 360 },
          }),
        );
        continue;
      }

      // Paragraf biasa / baris kosong
      if (trimmed.length === 0) {
        children.push(new Paragraph({ text: "" }));
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: stripInline(trimmed), size: 22 })],
            spacing: { after: 80 },
          }),
        );
      }
    }
  });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "prd-numbering",
          levels: [
            { level: 0, format: docx.LevelFormat.DECIMAL, text: "%1.", alignment: docx.AlignmentType.START },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `PRD_${sanitizeFilename(productType)}_${Date.now()}.docx`);
}

// --- PDF (client-side via jsPDF + autoTable) --------------------------------

export async function exportPdf(content: string, productType: string, language: "id" | "en" = "id"): Promise<void> {
  const charts = extractMermaidCharts(content);
  const chartImageMap = new Map<string, PngResult | null>();
  if (charts.length > 0) {
    await withLightMermaid(async () => {
      const results = await Promise.all(charts.map((c) => renderMermaidToPng(c)));
      charts.forEach((c, idx) => {
        chartImageMap.set(c, results[idx]);
      });
    });
  }
  const { jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, fontSize: number, opts: { bold?: boolean; indent?: number } = {}) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    const indent = opts.indent ?? 0;
    // Normalisasi: kode fallback (mermaid/non-mermaid) bisa berisi char
    // non-ASCII (box-drawing, dll) yang jsPDF render sebagai "%"/byte mentah.
    const safe = normalizePdfText(text);
    const wrapped = doc.splitTextToSize(safe, maxWidth - indent) as string[];
    const lineHeight = fontSize * 1.4;
    for (const w of wrapped) {
      ensureSpace(lineHeight);
      doc.text(w, margin + indent, y);
      y += lineHeight;
    }
  };

  // Pengukur netral (base style normal) untuk kalkulasi tinggi sel di didParseCell.
  const measureSeg = (text: string, seg: InlineSeg): number => {
    const [family, style] = fontStyleFor(seg, false, false);
    doc.setFont(family, style);
    return doc.getTextWidth(normalizePdfText(text));
  };

  // Renderer teks rich (bold/italic/code inline) dengan word-wrap manual &
  // hanging indent. jsPDF splitTextToSize tidak mendukung font campuran per
  // token, jadi kita bungkus per-kata sambil melacak gaya tiap token.
  const writeRichText = (
    textOrSegs: string | InlineSeg[],
    fontSize: number,
    opts: {
      bold?: boolean;
      italic?: boolean;
      indent?: number;
      hangingIndent?: number;
      // Bila diisi, gambar dibatasi ke kotak ini (dipakai untuk sel tabel
      // autoTable) dan page-break logic dilewati — autoTable yang atur baris.
      bounds?: { left: number; right: number };
    } = {},
  ) => {
    const baseBold = opts.bold ?? false;
    const baseItalic = opts.italic ?? false;
    const firstIndent = opts.indent ?? 0;
    const hangIndent = opts.hangingIndent ?? firstIndent;
    const lineHeight = fontSize * 1.4;
    const inCell = !!opts.bounds;
    const leftEdge = opts.bounds ? opts.bounds.left : margin + firstIndent;
    const rightEdge = opts.bounds ? opts.bounds.right : margin + maxWidth;
    doc.setFontSize(fontSize);

    // Ukur & gambar lewat layout bersama → hitungan baris di sini PASTI sama
    // dengan yang dipakai reservasi tinggi sel di didParseCell.
    const measure = (text: string, seg: InlineSeg): number => {
      const [family, style] = fontStyleFor(seg, baseBold, baseItalic);
      doc.setFont(family, style);
      return doc.getTextWidth(normalizePdfText(text));
    };
    const segs = Array.isArray(textOrSegs) ? textOrSegs : parseInline(textOrSegs);
    const lines = layoutInline(segs, rightEdge - leftEdge, measure, inCell);
    if (lines.length === 0) return;

    if (!inCell) ensureSpace(lineHeight);
    for (let li = 0; li < lines.length; li++) {
      let x = opts.bounds ? opts.bounds.left : margin + (li === 0 ? firstIndent : hangIndent);
      for (const tok of lines[li]) {
        const [family, style] = fontStyleFor(tok.seg, baseBold, baseItalic);
        doc.setFont(family, style);
        const renderText = normalizePdfText(tok.text);
        doc.text(renderText, x, y);
        x += doc.getTextWidth(renderText);
      }
      y += lineHeight;
      if (!inCell && li < lines.length - 1) ensureSpace(lineHeight);
    }
  };

  const drawHorizontalRule = () => {
    ensureSpace(14);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.75);
    doc.line(margin, y, margin + maxWidth, y);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    y += 12;
  };

  const lines = content.split("\n");

  // Skip YAML frontmatter (`---` di awal dokumen sampai penutup `---`)
  let startIdx = 0;
  if (lines[0]?.trim() === "---") {
    startIdx = 1;
    while (startIdx < lines.length && lines[startIdx].trim() !== "---") {
      startIdx++;
    }
    startIdx++; // lewati penutup ---
  }

  await withLightMermaid(async () => {
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      // Strip tag HTML mentah (<br>, <div>, <span> dll) — AI kadang menyisipkan
      // tag HTML di teks paragraf; di PDF harus jadi spasi / dihilangkan.
      const trimmed = line
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
        .trim();

      // Code fence — deteksi mermaid vs lain
      if (trimmed.startsWith("```")) {
        const lang = fenceLang(trimmed);
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }

        if (lang === "mermaid") {
          const chartCode = codeLines.join("\n");
          const png = chartImageMap.get(chartCode) ?? (await renderMermaidToPng(chartCode));
          if (png) {
            // Skala agar memenuhi lebar konten PDF (boleh upscale bila sumber
            // kecil). Tinggi dibatasi tinggi halaman agar tidak terpotong /
            // overflow. Rasio aspek selalu dipertahankan.
            const maxH = pageHeight - margin * 2;
            let scale = maxWidth / png.width;
            if (png.height * scale > maxH) scale = maxH / png.height;
            const dispW = png.width * scale;
            const dispH = png.height * scale;
            ensureSpace(dispH + 10);
            // Pusatkan horizontal agar selaras dengan DOCX (AlignmentType.CENTER).
            const x = margin + (maxWidth - dispW) / 2;
            doc.addImage(png.dataUrl, "PNG", x, y, dispW, dispH);
            y += dispH + 12;
          } else {
            // Fallback: kode mentah
            for (const cl of codeLines) {
              writeWrapped(cl, 9, { indent: 12 });
            }
            y += 6;
          }
        } else {
          for (const cl of codeLines) {
            writeWrapped(cl, 9, { indent: 12 });
          }
          y += 6;
        }
        continue;
      }

      // Tabel — render native via autoTable
      if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const header = parseTableRow(line);
        // Collector membuang separator GFM nyasar & menelan `---` di antara
        // baris tabel — lihat collectTableBodyRows.
        const { rows: bodyRows, endIdx } = collectTableBodyRows(lines, i + 2);
        i = endIdx - 1;

        // Normalisasi sel ke ASCII — autoTable merender via jsPDF juga, sehingga
        // char non-ASCII (•, —, box-drawing) sama rusaknya bila tak dinormalisasi.
        // Marker inline di-strip HANYA untuk kalkulasi layout autoTable (tinggi
        // baris/wrap); teks yang digambar manual di didDrawCell memakai token
        // hasil parseInline dari teks mentah, sehingga glyph terlihat identik.
        const head = [header.map((c) => normalizePdfText(stripInline(c)))];
        const body = bodyRows.map((r) => r.map((c) => normalizePdfText(stripInline(c))));

        // Segmen rich-text per sel (body), di-parse sekali dari teks mentah.
        const richSegs = bodyRows.map((r) => r.map((c) => parseInline(c)));
        interface RichCell {
          richSegs?: InlineSeg[];
        }

        autoTable(doc, {
          head,
          body,
          startY: y,
          margin: { left: margin, right: margin },
          theme: "grid",
          // Padding vertikal 3pt + horizontal 4pt → lega tapi tidak boros.
          // Sebelumnya 4pt semua sisi (padV 8pt) bikin sel 1-baris 20.6pt;
          // sekarang 6pt vertikal → 18.6pt, hemat ~2pt per baris.
          styles: {
            fontSize: 9,
            cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
            textColor: [40, 40, 40],
            overflow: "linebreak",
            valign: "top",
          },
          headStyles: {
            fillColor: [235, 235, 235],
            textColor: [17, 17, 17],
            fontStyle: "bold",
            halign: "left",
          },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          didParseCell(data) {
            if (data.section !== "body") return;
            const segs = richSegs[data.row.index]?.[data.column.index];
            if (!segs) return;
            (data.cell as unknown as RichCell).richSegs = segs;
            // Jangan over-reserve: pasang baseline minimal (1 baris) saja.
            // Estimasi 0.85*equalSplit sebelumnya bikin avail terlalu sempit
            // → nLines kebanyakan → minCellHeight kelewat tinggi (boros).
            // Tinggi final yang PAS akan dihitung di willDrawCell dengan
            // lebar kolom FINAL yang akurat.
            const padV = data.cell.padding("top") + data.cell.padding("bottom");
            data.cell.styles.minCellHeight = richCellHeight(1, 9, padV);
          },
          willDrawCell(data) {
            const rich = (data.cell as unknown as RichCell).richSegs;
            if (!rich) return;
            // Hapus teks default autoTable — kita gambar rich manual di didDrawCell
            data.cell.text = [];

            // Hitung tinggi PAS berdasar lebar FINAL. Untuk baris yang
            // sama, semua sel harus seragam → hitung maxNeeded satu kali
            // di sel pertama (index 0) agar cell pertama pun sudah pakai
            // tinggi final sebelum rect digambar.
            if (data.column.index === 0) {
              let maxNeeded = 0;
              for (const col of data.table.columns) {
                const cell = data.row.cells[col.index] as unknown as RichCell & { width: number; height: number; padding: (n: string) => number };
                const segs = (cell as unknown as RichCell).richSegs;
                if (segs && segs.length > 0) {
                  const padH = (cell as unknown as { padding: (s: string) => number }).padding("left") + (cell as unknown as { padding: (s: string) => number }).padding("right");
                  const avail = Math.max(20, (cell as unknown as { width: number }).width - padH);
                  doc.setFontSize(9);
                  const laid = layoutInline(segs, avail, measureSeg, true);
                  const padV = (cell as unknown as { padding: (s: string) => number }).padding("top") + (cell as unknown as { padding: (s: string) => number }).padding("bottom");
                  const needed = richCellHeight(Math.max(1, laid.length), 9, padV);
                  if (needed > maxNeeded) maxNeeded = needed;
                } else {
                  // Sel tanpa rich (kosong) — pakai tinggi autoTable sebagai fallback
                  const h = (cell as unknown as { height: number }).height;
                  if (h > maxNeeded) maxNeeded = h;
                }
              }
              if (maxNeeded > 0) {
                data.row.height = maxNeeded;
                for (const col of data.table.columns) {
                  const c = data.row.cells[col.index] as unknown as { height: number };
                  if (c) c.height = maxNeeded;
                }
              }
            } else {
              // Sel berikutnya: sinkronkan tinggi sel ke row.height
              // (sudah di-set oleh sel pertama). Jika sel ini ternyata
              // butuh lebih tinggi dari max yang dihitung di sel pertama
              // (edge: text sangat panjang di kolom tengah), grow lagi.
              const padH = data.cell.padding("left") + data.cell.padding("right");
              const avail = Math.max(20, data.cell.width - padH);
              doc.setFontSize(9);
              const laid = layoutInline(rich, avail, measureSeg, true);
              const padV = data.cell.padding("top") + data.cell.padding("bottom");
              const neededH = richCellHeight(Math.max(1, laid.length), 9, padV);
              if (neededH > data.row.height) {
                const newH = neededH;
                data.row.height = newH;
                for (const col of data.table.columns) {
                  const c = data.row.cells[col.index] as unknown as { height: number };
                  if (c) c.height = newH;
                }
              } else if (data.row.height > data.cell.height) {
                data.cell.height = data.row.height;
              }
            }
          },
          didDrawCell(data) {
            const segs = (data.cell as unknown as RichCell).richSegs;
            if (!segs || segs.length === 0) return;
            const padTop = data.cell.padding("top");
            const yRestore = y;
            y = data.cell.y + padTop + 9 * 1.05; // baseline baris pertama
            writeRichText(segs, 9, {
              bounds: {
                left: data.cell.x + data.cell.padding("left"),
                right: data.cell.x + data.cell.width - data.cell.padding("right"),
              },
            });
            y = yRestore;
          },
        });

        // finalY dilacak oleh autoTable di doc.lastAutoTable
        const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
        y = (lastAutoTable?.finalY ?? y) + 12;
        continue;
      }

      // Horizontal rule (--- / *** / ___ / ===) — gambar garis tipis, bukan teks dash.
      // PRD memakai "---" sebagai pemisah antar user story / edge case.
      if (isThematicBreak(trimmed)) {
        drawHorizontalRule();
        continue;
      }

      // Heading — hierarki visual jelas via ukuran + spacing + garis bawah (H2).
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const depth = headingMatch[1].length;
        const size = depth === 1 ? 22 : depth === 2 ? 18 : depth === 3 ? 14 : 12;
        const headLineH = size * 1.4;
        y += depth === 2 ? 18 : depth === 3 ? 14 : 10;
        ensureSpace(headLineH + 12);
        const yBefore = y;
        writeRichText(headingMatch[2], size, { bold: true });
        // Garis bawah tipis untuk H2 (chapter) agar pemisah bab terlihat jelas.
        // ruleAt = sedikit di bawah baseline baris terakhir heading.
        if (depth === 2) {
          const ruleAt = y - headLineH + 5;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.line(margin, ruleAt, margin + maxWidth, ruleAt);
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(1);
          y = ruleAt + 8;
        } else {
          y = Math.max(y, yBefore + headLineH) + 4;
        }

        // Section WBS: bullet di bawah heading ini dirender sebagai autoTable
        // ber-rowSpan (Modul/Fitur/Sub-fitur), bukan bullet bersarang.
        if (depth <= 4 && WBS_SECTION_RE.test(headingMatch[2])) {
          const { endIdx, block } = collectWbsBlock(lines, i + 1, depth);
          i = endIdx - 1; // loop akan i++ lagi; fallback (tanpa bullet) → baris diproses normal
          const items = parseBulletTree(block);
          if (items.length > 0) {
            // Sel dengan rowSpan: baris lanjutan grup menghilangkan sel yang
            // sudah tertutup rowSpan (didukung native oleh jspdf-autotable).
            type PdfCell = string | { content: string; rowSpan: number };
            const body = wbsTableRows(wbsRows(items)).map((r): PdfCell[] => {
              const cells: PdfCell[] = [];
              if (r.module !== null) cells.push({ content: normalizePdfText(r.module), rowSpan: r.moduleSpan ?? 1 });
              if (r.feature !== null) cells.push({ content: normalizePdfText(r.feature), rowSpan: r.featureSpan ?? 1 });
              cells.push(normalizePdfText(r.sub));
              return cells;
            });

            autoTable(doc, {
              head: [wbsHeaders(language).map(normalizePdfText)],
              body,
              startY: y,
              margin: { left: margin, right: margin },
              theme: "grid",
              // Samakan breathing dengan tabel regular: vertikal 3pt, horizontal 4pt
              styles: {
                fontSize: 9,
                cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
                textColor: [40, 40, 40],
                overflow: "linebreak",
                valign: "middle",
              },
              headStyles: {
                fillColor: [235, 235, 235],
                textColor: [17, 17, 17],
                fontStyle: "bold",
                halign: "left",
              },
              alternateRowStyles: { fillColor: [248, 248, 248] },
            });

            const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
            y = (lastAutoTable?.finalY ?? y) + 12;

            // Tail note (prosa setelah blok bullet) — tidak boleh hilang.
            for (const tl of wbsTailNote(block).split("\n")) {
              if (!tl.trim()) continue;
              writeRichText(tl, 11);
              y += 4;
            }
            continue;
          }
        }
        continue;
      }

      // List item — bullet/angka dengan hanging indent agar baris lanjutan
      // rapi sejajar di bawah teks (bukan di bawah bullet).
      const listMatch = trimmed.match(/^[-*+]\s+(.*)/);
      if (listMatch) {
        writeRichText(`•  ${listMatch[1]}`, 11, { indent: 12, hangingIndent: 24 });
        y += 2;
        continue;
      }
      const orderedMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
      if (orderedMatch) {
        writeRichText(`${orderedMatch[1]}  ${orderedMatch[2]}`, 11, { indent: 12, hangingIndent: 26 });
        y += 2;
        continue;
      }

      // Blockquote — italik, menjorok, dengan garis vertikal di kiri.
      const quoteMatch = trimmed.match(/^>\s?(.*)/);
      if (quoteMatch) {
        const yStart = y;
        writeRichText(quoteMatch[1], 11, { italic: true, indent: 20, hangingIndent: 20 });
        const barTop = yStart - 9;
        const barBottom = y - 3;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(2);
        doc.line(margin + 8, barTop, margin + 8, barBottom);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        y += 4;
        continue;
      }

      if (trimmed.length === 0) {
        y += 4;
        continue;
      }

      // Paragraf biasa — rich text (bold/italic/code) + spasi setelah.
      writeRichText(trimmed, 11);
      y += 6;
    }
  });

  doc.save(`PRD_${sanitizeFilename(productType)}_${Date.now()}.pdf`);
}

// --- JSON terstruktur (Task 3.7 bonus) --------------------------------------

export function exportJson(content: string, productType: string): void {
  const sections: Section[] = getSections(content);
  const payload = sections.map((s) => ({
    heading: s.heading,
    level: s.level,
    content: s.content,
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  triggerDownload(blob, `PRD_${sanitizeFilename(productType)}_${Date.now()}.json`);
}
