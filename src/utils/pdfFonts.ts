// Self-hosted Unicode TTF font loader for jsPDF.
// Unpacks the WOFF 1.0 files already shipped by @fontsource/inter and
// @fontsource/jetbrains-mono into TrueType (sfnt) binaries on demand using
// Web DecompressionStream("deflate") — zero extra dependencies, zero CDN calls,
// and lazy-loaded only when the user clicks Export PDF.
import type { jsPDF } from "jspdf";
import interRegularUrl from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import interBoldUrl from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import interItalicUrl from "@fontsource/inter/files/inter-latin-400-italic.woff?url";
import interBoldItalicUrl from "@fontsource/inter/files/inter-latin-700-italic.woff?url";
import jetbrainsRegularUrl from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url";
import jetbrainsBoldUrl from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url";

export interface PdfFontFamilies {
  sans: string;
  mono: string;
  unicode: boolean;
}

export interface FontFaceSpec {
  vfsName: string;
  family: string;
  style: "normal" | "bold" | "italic" | "bolditalic";
  url: string;
}

export const PDF_FONT_FACES: FontFaceSpec[] = [
  { vfsName: "Inter-Regular.ttf", family: "Inter", style: "normal", url: interRegularUrl },
  { vfsName: "Inter-Bold.ttf", family: "Inter", style: "bold", url: interBoldUrl },
  { vfsName: "Inter-Italic.ttf", family: "Inter", style: "italic", url: interItalicUrl },
  { vfsName: "Inter-BoldItalic.ttf", family: "Inter", style: "bolditalic", url: interBoldItalicUrl },
  { vfsName: "JetBrainsMono-Regular.ttf", family: "JetBrainsMono", style: "normal", url: jetbrainsRegularUrl },
  { vfsName: "JetBrainsMono-Bold.ttf", family: "JetBrainsMono", style: "bold", url: jetbrainsBoldUrl },
];

const WOFF_SIGNATURE = 0x774f4646; // "wOFF"
const SFNT_TRUETYPE_1 = 0x00010000;
const SFNT_TRUETYPE_2 = 0x74727565; // "true"

async function inflateZlib(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream unavailable");
  }
  const payload = new Uint8Array(compressed.byteLength);
  payload.set(compressed);
  const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream("deflate"));
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Decompress a WOFF 1.0 TrueType container into a raw sfnt `.ttf` Uint8Array
 * compatible with jsPDF's `addFont`.
 */
export async function woffToTtf(woff: Uint8Array): Promise<Uint8Array> {
  if (woff.byteLength < 44) {
    throw new Error("Invalid WOFF buffer: too short");
  }
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  const sig = view.getUint32(0, false);
  if (sig !== WOFF_SIGNATURE) {
    throw new Error(`Invalid WOFF signature: 0x${sig.toString(16)}`);
  }

  const flavor = view.getUint32(4, false);
  if (flavor !== SFNT_TRUETYPE_1 && flavor !== SFNT_TRUETYPE_2) {
    throw new Error(`Unsupported WOFF sfnt flavor for jsPDF TTF: 0x${flavor.toString(16)}`);
  }

  const numTables = view.getUint16(12, false);
  const totalSfntSize = view.getUint32(16, false);
  if (44 + numTables * 20 > woff.byteLength) {
    throw new Error("Invalid WOFF table directory");
  }

  const out = new Uint8Array(totalSfntSize);
  const outView = new DataView(out.buffer);

  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 16;
  const rangeShift = numTables * 16 - searchRange;

  outView.setUint32(0, flavor, false);
  outView.setUint16(4, numTables, false);
  outView.setUint16(6, searchRange, false);
  outView.setUint16(8, entrySelector, false);
  outView.setUint16(10, rangeShift, false);

  let dataOffset = 12 + numTables * 16;
  for (let i = 0; i < numTables; i++) {
    const entryOff = 44 + i * 20;
    const offset = view.getUint32(entryOff + 4, false);
    const compLen = view.getUint32(entryOff + 8, false);
    const origLen = view.getUint32(entryOff + 12, false);
    const origChecksum = view.getUint32(entryOff + 16, false);

    const slice = woff.subarray(offset, offset + compLen);
    const rawTable = compLen < origLen ? await inflateZlib(slice) : slice;
    if (rawTable.byteLength !== origLen) {
      throw new Error(`Decompressed WOFF table length mismatch: expected ${origLen}, got ${rawTable.byteLength}`);
    }

    const dirOff = 12 + i * 16;
    out.set(woff.subarray(entryOff, entryOff + 4), dirOff);
    outView.setUint32(dirOff + 4, origChecksum, false);
    outView.setUint32(dirOff + 8, dataOffset, false);
    outView.setUint32(dirOff + 12, origLen, false);

    out.set(rawTable, dataOffset);
    dataOffset += (origLen + 3) & ~3;
  }

  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    let str = "";
    for (let j = 0; j < sub.length; j++) {
      str += String.fromCharCode(sub[j]);
    }
    parts.push(str);
  }
  return btoa(parts.join(""));
}

let cachedFontBase64: Map<string, string> | null = null;

async function fetchWoffBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch font asset (${res.status}): ${url}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Load & register Inter + JetBrains Mono TrueType fonts onto a jsPDF instance.
 * Caches unpacked base64 TTFs across exports and falls back cleanly to built-in
 * helvetica/courier if font loading fails in restricted environments.
 */
export async function registerPdfFonts(
  doc: jsPDF,
  loader?: (face: FontFaceSpec) => Promise<Uint8Array>,
): Promise<PdfFontFamilies> {
  try {
    const useCache = !loader;
    const effectiveLoader = loader ?? ((face: FontFaceSpec) => fetchWoffBytes(face.url));
    let base64Map = useCache ? cachedFontBase64 : null;
    if (!base64Map) {
      const entries = await Promise.all(
        PDF_FONT_FACES.map(async (face) => {
          const woff = await effectiveLoader(face);
          const ttf = await woffToTtf(woff);
          return [face.vfsName, bytesToBase64(ttf)] as const;
        }),
      );
      base64Map = new Map(entries);
      if (useCache) {
        cachedFontBase64 = base64Map;
      }
    }

    for (const face of PDF_FONT_FACES) {
      const b64 = base64Map.get(face.vfsName);
      if (!b64) continue;
      doc.addFileToVFS(face.vfsName, b64);
      doc.addFont(face.vfsName, face.family, face.style);
    }

    return { sans: "Inter", mono: "JetBrainsMono", unicode: true };
  } catch (err) {
    console.warn("Falling back to built-in PDF fonts:", err);
    return { sans: "helvetica", mono: "courier", unicode: false };
  }
}

/**
 * Normalize text for jsPDF rendering:
 * - When embedded Inter / JetBrains Mono TTF is active (`unicode: true`),
 *   native Latin-1 + typographic glyphs (×, ÷, ±, °, –, —, •, …, ‘’“”, €, ©, ®, ™)
 *   are preserved intact, and only glyphs outside the Latin subset (math inequalities,
 *   arrows, box-drawing, emojis) are mapped cleanly to ASCII so zero tofu boxes appear.
 * - When built-in StandardEncoding fonts are active (`unicode: false`),
 *   all non-ASCII glyphs are normalized cleanly to ASCII.
 */
export function normalizePdfText(s: string, unicode = false): string {
  // Always normalize box-drawing, arrows, inequalities, and checkmarks not in Latin subset
  const common = s
    .replace(/[\u2500\u2501\u2504\u2505\u2506\u2507\u2508\u2509\u250A\u250B\u254C\u254D]/g, "-")
    .replace(/[\u2502\u2503\u250E\u250F\u254E\u254F]/g, "|")
    .replace(
      /[\u250C\u250D\u2510\u2511\u2514\u2515\u2518\u2519\u251C\u251D\u251E\u251F\u2520\u2521\u2522\u2523\u2524\u2525\u2526\u2527\u2528\u2529\u252A\u252B\u252C\u252D\u252E\u252F\u2530\u2531\u2532\u2533\u2534\u2535\u2536\u2537\u2538\u2539\u253A\u253B\u253C\u253D\u253E\u253F\u2540\u2541\u2542\u2543\u2544\u2545\u2546\u2547\u2548\u2549\u254A\u254B]/g,
      "+",
    )
    .replace(/\u2550/g, "=")
    .replace(/\u2551/g, "|")
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2191/g, "^")
    .replace(/\u2193/g, "v")
    .replace(/\u21D2/g, "=>")
    .replace(/\u21D0/g, "<=")
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u2260/g, "!=")
    .replace(/\u2248/g, "~=")
    .replace(/[\u2713\u2714]/g, "[v]")
    .replace(/[\u2717\u2718]/g, "[x]")
    .replace(/\u00A0/g, " ");

  if (unicode) {
    // Normalize rare dash/quote variants onto glyphs present in Inter/JetBrains Mono Latin cmap
    return common
      .replace(/[\u2010\u2011\u2012\u2015]/g, "\u2013")
      .replace(/[\u201A\u2032\u02B9]/g, "\u2019")
      .replace(/[\u201E\u2033\u02BA]/g, "\u201D")
      .replace(/[\u25CF\u25CB]/g, "\u2022")
      .replace(
        /[^\x20-\x7E\r\n\t\u00A1-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC\u2122]/g,
        "",
      );
  }

  return common
    .replace(/[\u2022\u25CF\u25CB]/g, "*")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019\u201A\u2032\u02B9]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033\u02BA]/g, '"')
    .replace(/\u00B0/g, " deg")
    .replace(/\u00B1/g, "+/-")
    .replace(/\u00D7/g, "x")
    .replace(/\u00F7/g, "/")
    .replace(/\u20AC/g, "EUR")
    .replace(/\u00A9/g, "(c)")
    .replace(/\u00AE/g, "(R)")
    .replace(/\u2122/g, "TM")
    .replace(/[^\x20-\x7E\r\n\t]/g, "");
}
