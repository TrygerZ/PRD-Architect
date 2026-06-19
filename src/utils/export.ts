// Task 3.1 — Export PRD ke DOCX, PDF, dan JSON terstruktur.
// Lazy-import lib berat (docx, jspdf, jspdf-autotable, mermaid) hanya saat dipakai.
// Mermaid diagram dirender ke PNG (SVG → canvas → dataURL) lalu disisipkan sebagai gambar.
import { getSections, type Section } from "./sections";
import { sanitizeMermaid } from "./mermaid";

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

interface ParsedTable {
  header: string[];
  rows: string[][];
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => stripInline(c.trim()));
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(line) && line.includes("-");
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
  securityLevel: "loose" as const,
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
    const { svg } = await mermaid.render(id, normalized);
    return await svgToPng(svg);
  } catch (err) {
    console.warn("Mermaid render for export failed:", err);
    return null;
  }
}

/**
 * Ekstrak dimensi piksel intrinsik dari <svg>.
 * Mermaid v11 sering menulis width="100%" (bukan piksel) — parseFloat("100%")
 * menghasilkan 100, yang membuat canvas salah rasio (gambar jadi kecil &
 * tidak proporsional). Prioritas: atribut width/height numerik → viewBox →
 * max-width dari style → fallback.
 */
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

export async function exportDocx(content: string, productType: string): Promise<void> {
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
  } = docx;

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
          const png = await renderMermaidToPng(codeLines.join("\n"));
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

        const makeCell = (text: string, bold: boolean) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
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

        children.push(new Table({ rows: docRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
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

export async function exportPdf(content: string, productType: string): Promise<void> {
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
    const wrapped = doc.splitTextToSize(text, maxWidth - indent) as string[];
    const lineHeight = fontSize * 1.4;
    for (const w of wrapped) {
      ensureSpace(lineHeight);
      doc.text(w, margin + indent, y);
      y += lineHeight;
    }
  };

  const lines = content.split("\n");

  await withLightMermaid(async () => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

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
          const png = await renderMermaidToPng(codeLines.join("\n"));
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
        const bodyRows: string[][] = [];
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          bodyRows.push(parseTableRow(lines[i]));
          i++;
        }
        i--;

        autoTable(doc, {
          head: [header],
          body: bodyRows,
          startY: y,
          margin: { left: margin, right: margin },
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 4, textColor: [40, 40, 40], overflow: "linebreak" },
          headStyles: {
            fillColor: [235, 235, 235],
            textColor: [17, 17, 17],
            fontStyle: "bold",
            halign: "left",
          },
          alternateRowStyles: { fillColor: [248, 248, 248] },
        });

        // finalY dilacak oleh autoTable di doc.lastAutoTable
        const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
        y = (lastAutoTable?.finalY ?? y) + 12;
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const depth = headingMatch[1].length;
        const size = depth === 1 ? 20 : depth === 2 ? 16 : 13;
        y += 8;
        writeWrapped(stripInline(headingMatch[2]), size, { bold: true });
        y += 2;
        continue;
      }

      const listMatch = trimmed.match(/^[-*+]\s+(.*)/);
      if (listMatch) {
        writeWrapped(`•  ${stripInline(listMatch[1])}`, 11, { indent: 12 });
        continue;
      }
      const orderedMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
      if (orderedMatch) {
        writeWrapped(`${orderedMatch[1]}  ${stripInline(orderedMatch[2])}`, 11, { indent: 12 });
        continue;
      }

      if (trimmed.length === 0) {
        y += 6;
        continue;
      }

      writeWrapped(stripInline(trimmed), 11);
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
