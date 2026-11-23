// Editorial Print Edition PDF exporter powered by jsPDF + jspdf-autotable
// with self-hosted Unicode Inter & JetBrains Mono TTF fonts, proportional tables,
// page-break-safe blockquotes/code blocks, vector nested bullets, anti-orphan headings,
// and running headers & footers.
import type { jsPDF } from "jspdf";
import { parseBulletTree } from "./wbs";
import { WBS_SECTION_RE, wbsRows, wbsTableRows, wbsTailNote } from "./wbsTable";
import {
  buildExportMeta,
  collectTableBodyRows,
  collectWbsBlock,
  computeColumnWeights,
  computeMermaidDisplaySize,
  deriveExportSlug,
  fenceLang,
  isTableSeparator,
  isThematicBreak,
  layoutInline,
  parseInline,
  parseListLine,
  parseTableRow,
  richCellHeight,
  stripHtmlTags,
  stripInline,
  stripYamlFrontmatter,
  wbsHeaders,
  type InlineSeg,
} from "./exportMarkdown";
import { renderAllMermaidCharts, type PngResult } from "./exportMermaid";
import {
  normalizePdfText,
  registerPdfFonts,
  type FontFaceSpec,
  type PdfFontFamilies,
} from "./pdfFonts";

type Rgb = [number, number, number];

const INK: Rgb = [31, 41, 55];
const HEADING: Rgb = [17, 24, 39];
const SUBHEADING: Rgb = [30, 41, 59];
const MUTED: Rgb = [100, 116, 139];
const ACCENT: Rgb = [138, 112, 71];
const ACCENT_SOFT: Rgb = [212, 195, 163];
const BORDER: Rgb = [209, 213, 219];
const BORDER_LIGHT: Rgb = [226, 232, 240];
const HEADER_BG: Rgb = [238, 242, 246];
const ZEBRA_BG: Rgb = [250, 251, 253];
const CODE_BG: Rgb = [244, 246, 248];
const INLINE_CODE_BG: Rgb = [241, 245, 249];
const QUOTE_BG: Rgb = [250, 248, 244];

const INLINE_CODE_PAD_X = 2.2;

function fontStyleFor(
  seg: InlineSeg,
  baseBold: boolean,
  baseItalic: boolean,
  fonts: PdfFontFamilies,
): [string, string] {
  const bold = baseBold || !!seg.bold;
  const italic = baseItalic || !!seg.italic;
  if (seg.code) {
    // JetBrainsMono registers normal + bold (no italic needed for code spans)
    return [fonts.mono, bold ? "bold" : "normal"];
  }
  return [
    fonts.sans,
    bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal",
  ];
}

export interface BuildPdfOptions {
  preRenderedCharts?: Map<string, PngResult | null>;
  fontLoader?: (face: FontFaceSpec) => Promise<Uint8Array>;
}

export async function buildPdfDocument(
  content: string,
  productType: string,
  language: "id" | "en" = "id",
  options: BuildPdfOptions = {},
): Promise<{ doc: jsPDF; fonts: PdfFontFamilies }> {
  const chartImageMap =
    options.preRenderedCharts ?? (await renderAllMermaidCharts(content));
  const { jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = autoTableMod.default;

  // compress: true compresses page operator streams with FlateDecode (cutting
  // multi-page PDF size by ~80-95% alongside FAST image compression below).
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const fonts = await registerPdfFonts(doc, options.fontLoader);
  const meta = buildExportMeta(content, productType, language);

  const marginX = 46;
  const topMargin = 54;
  const bottomMargin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  const maxY = pageHeight - bottomMargin;
  let y = topMargin;

  const safeText = (s: string) => normalizePdfText(s, fonts.unicode);

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > maxY) {
      doc.addPage();
      y = topMargin;
    }
  };

  const setRgbText = (rgb: Rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setRgbDraw = (rgb: Rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const setRgbFill = (rgb: Rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);

  const measureToken = (
    text: string,
    seg: InlineSeg,
    fontSize: number,
    baseBold: boolean,
    baseItalic: boolean,
  ): number => {
    const [family, style] = fontStyleFor(seg, baseBold, baseItalic, fonts);
    doc.setFont(family, style);
    doc.setFontSize(seg.code ? Math.max(7.5, fontSize - 0.8) : fontSize);
    const w = doc.getTextWidth(safeText(text));
    return seg.code && text.trim().length > 0 ? w + INLINE_CODE_PAD_X * 2 : w;
  };

  const writeRichText = (
    textOrSegs: string | InlineSeg[],
    fontSize: number,
    opts: {
      bold?: boolean;
      italic?: boolean;
      color?: Rgb;
      indent?: number;
      hangingIndent?: number;
      lineHeightRatio?: number;
      bounds?: { left: number; right: number };
      onLineStart?: (lineIdx: number, lineY: number, lineHeight: number) => void;
    } = {},
  ) => {
    const baseBold = opts.bold ?? false;
    const baseItalic = opts.italic ?? false;
    const color = opts.color ?? INK;
    const firstIndent = opts.indent ?? 0;
    const hangIndent = opts.hangingIndent ?? firstIndent;
    const lineHeight = fontSize * (opts.lineHeightRatio ?? 1.45);
    const inCell = !!opts.bounds;
    const firstAvail = opts.bounds
      ? opts.bounds.right - opts.bounds.left
      : maxWidth - firstIndent;
    const contAvail = opts.bounds ? undefined : maxWidth - hangIndent;

    const measure = (text: string, seg: InlineSeg) =>
      measureToken(text, seg, fontSize, baseBold, baseItalic);

    const segs = Array.isArray(textOrSegs) ? textOrSegs : parseInline(textOrSegs);
    const wrappedLines = layoutInline(segs, firstAvail, measure, inCell, contAvail);
    if (wrappedLines.length === 0) return;

    if (!inCell) ensureSpace(lineHeight);

    for (let li = 0; li < wrappedLines.length; li++) {
      opts.onLineStart?.(li, y, lineHeight);
      let x = opts.bounds
        ? opts.bounds.left
        : marginX + (li === 0 ? firstIndent : hangIndent);

      for (const tok of wrappedLines[li]) {
        const [family, style] = fontStyleFor(tok.seg, baseBold, baseItalic, fonts);
        const tokSize = tok.seg.code ? Math.max(7.5, fontSize - 0.8) : fontSize;
        doc.setFont(family, style);
        doc.setFontSize(tokSize);
        const renderText = safeText(tok.text);
        const textW = doc.getTextWidth(renderText);

        if (tok.seg.code && !tok.space && renderText.trim().length > 0) {
          const pillW = textW + INLINE_CODE_PAD_X * 2;
          const pillH = tokSize * 1.25;
          setRgbFill(INLINE_CODE_BG);
          setRgbDraw(BORDER_LIGHT);
          doc.setLineWidth(0.4);
          doc.roundedRect(x, y - tokSize * 0.92, pillW, pillH, 2, 2, "FD");
          setRgbText(SUBHEADING);
          doc.text(renderText, x + INLINE_CODE_PAD_X, y);
          x += pillW;
        } else {
          setRgbText(tok.seg.code ? SUBHEADING : color);
          doc.text(renderText, x, y);
          x += textW;
        }
      }

      y += lineHeight;
      if (!inCell && li < wrappedLines.length - 1) {
        ensureSpace(lineHeight);
      }
    }
  };

  // --- Page 1 Editorial Document Header Block ---
  doc.setFont(fonts.sans, "bold");
  doc.setFontSize(8);
  setRgbText(ACCENT);
  doc.text(safeText(meta.eyebrow), marginX, y);
  y += 22;

  writeRichText(meta.title, 18.5, { bold: true, color: HEADING, lineHeightRatio: 1.3 });
  y += 2;

  doc.setFont(fonts.sans, "normal");
  doc.setFontSize(9);
  setRgbText(MUTED);
  doc.text(safeText(meta.subtitle), marginX, y);
  y += 10;

  setRgbDraw(ACCENT);
  doc.setLineWidth(1.4);
  doc.line(marginX, y, marginX + maxWidth, y);
  y += 18;

  const drawHorizontalRule = () => {
    ensureSpace(16);
    setRgbDraw(BORDER_LIGHT);
    doc.setLineWidth(0.75);
    doc.line(marginX, y, marginX + maxWidth, y);
    y += 14;
  };

  const drawCodeBlock = (codeLines: string[], lang?: string) => {
    const codeFontSize = 8.4;
    const codeLineH = codeFontSize * 1.42;
    const padX = 10;
    const padY = 8;
    const innerWidth = maxWidth - padX * 2;

    doc.setFont(fonts.mono, "normal");
    doc.setFontSize(codeFontSize);

    const wrappedAll: string[] = [];
    const sourceLines = codeLines.length > 0 ? codeLines : [""];
    for (const raw of sourceLines) {
      const safe = safeText(raw);
      if (!safe) {
        wrappedAll.push("");
        continue;
      }
      const parts = doc.splitTextToSize(safe, innerWidth) as string[];
      wrappedAll.push(...parts);
    }

    let cursor = 0;
    let showHeader = !!lang;

    // Keep short code blocks (<= 14 wrapped lines) together on a single page
    // so a closing brace `}` does not spill onto the top of the next page.
    const fullHeaderH = showHeader ? 18 : 0;
    const fullBoxH = fullHeaderH + padY * 2 + wrappedAll.length * codeLineH;
    if (wrappedAll.length <= 14 && fullBoxH <= maxY - topMargin) {
      ensureSpace(fullBoxH);
    }

    while (cursor < wrappedAll.length) {
      const headerH = showHeader ? 18 : 0;
      const minBlockH = headerH + padY * 2 + codeLineH;
      ensureSpace(minBlockH);

      const availableForLines = maxY - y - headerH - padY * 2;
      const linesThisPage = Math.max(
        1,
        Math.min(wrappedAll.length - cursor, Math.floor(availableForLines / codeLineH)),
      );
      const chunk = wrappedAll.slice(cursor, cursor + linesThisPage);
      const boxH = headerH + padY * 2 + chunk.length * codeLineH;

      // Card background + border
      setRgbFill(CODE_BG);
      setRgbDraw(BORDER);
      doc.setLineWidth(0.6);
      doc.roundedRect(marginX, y, maxWidth, boxH, 4, 4, "FD");

      // Optional language header strip
      if (showHeader && lang) {
        setRgbFill(HEADER_BG);
        doc.roundedRect(marginX, y, maxWidth, headerH, 4, 4, "F");
        setRgbDraw(BORDER_LIGHT);
        doc.line(marginX, y + headerH, marginX + maxWidth, y + headerH);
        doc.setFont(fonts.mono, "bold");
        doc.setFontSize(7.4);
        setRgbText(MUTED);
        doc.text(safeText(lang.toUpperCase()), marginX + padX, y + 12);
        showHeader = false;
      }

      doc.setFont(fonts.mono, "normal");
      doc.setFontSize(codeFontSize);
      setRgbText(SUBHEADING);
      let lineY = y + headerH + padY + codeFontSize * 0.9;
      for (const cl of chunk) {
        if (cl) doc.text(cl, marginX + padX, lineY);
        lineY += codeLineH;
      }

      y += boxH + 10;
      cursor += linesThisPage;
      if (cursor < wrappedAll.length) {
        doc.addPage();
        y = topMargin;
      }
    }
  };

  const rawLines = content.split(/\r?\n/);
  const startIdx = stripYamlFrontmatter(rawLines);

  for (let i = startIdx; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const cleanLine = stripHtmlTags(rawLine);
    const trimmed = cleanLine.trim();

    if (trimmed.length === 0) {
      y += 4;
      continue;
    }

    // Code fence (mermaid vs styled monospace code block)
    if (trimmed.startsWith("```")) {
      const lang = fenceLang(trimmed);
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }

      if (lang === "mermaid") {
        const chartCode = codeLines.join("\n");
        const png = chartImageMap.get(chartCode) ?? null;
        if (png) {
          const pad = 8;
          const captionH = 16;
          const maxImgW = maxWidth - pad * 2;
          const maxImgH = maxY - topMargin - pad * 2 - captionH - 8;
          const { width: dispW, height: dispH } = computeMermaidDisplaySize(
            png.width,
            png.height,
            maxImgW,
            maxImgH,
            1.15,
          );
          const cardW = dispW + pad * 2;
          const cardH = dispH + pad * 2;
          ensureSpace(cardH + captionH + 8);
          const cardX = marginX + (maxWidth - cardW) / 2;

          setRgbFill([255, 255, 255]);
          setRgbDraw(BORDER_LIGHT);
          doc.setLineWidth(0.6);
          doc.roundedRect(cardX, y, cardW, cardH, 4, 4, "FD");
          doc.addImage(png.dataUrl, "PNG", cardX + pad, y + pad, dispW, dispH, undefined, "FAST");

          doc.setFont(fonts.sans, "italic");
          doc.setFontSize(8);
          setRgbText(MUTED);
          const caption = "Diagram (Mermaid)";
          const capW = doc.getTextWidth(caption);
          doc.text(caption, marginX + (maxWidth - capW) / 2, y + cardH + 11);
          y += cardH + captionH + 8;
        } else {
          drawCodeBlock(codeLines, "mermaid");
        }
      } else {
        drawCodeBlock(codeLines, lang || undefined);
      }
      continue;
    }

    // Markdown table via autoTable with pre-computed proportional columnWidths & exact didParseCell height
    if (trimmed.startsWith("|") && i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1])) {
      const header = parseTableRow(rawLine);
      const { rows: bodyRows, endIdx } = collectTableBodyRows(rawLines, i + 2);
      i = endIdx - 1;

      const colWidths = computeColumnWeights(header, bodyRows, Math.floor(maxWidth), 66);
      // Absorb A4 sub-point remainder (e.g. 0.28pt) into the widest column so
      // autoTable aligns flush with both margins and emits zero resize warnings.
      const frac = maxWidth - colWidths.reduce((a, b) => a + b, 0);
      if (colWidths.length > 0 && Math.abs(frac) > 0.001) {
        let widest = 0;
        for (let c = 1; c < colWidths.length; c++) {
          if (colWidths[c] > colWidths[widest]) widest = c;
        }
        colWidths[widest] += frac;
      }
      const columnStyles: Record<number, { cellWidth: number }> = {};
      colWidths.forEach((w, idx) => {
        columnStyles[idx] = { cellWidth: w };
      });

      const head = [header.map((c) => safeText(stripInline(c)))];
      const body = bodyRows.map((r) =>
        header.map((_, ci) => safeText(stripInline(r[ci] ?? ""))),
      );
      const richSegs = bodyRows.map((r) => header.map((_, ci) => parseInline(r[ci] ?? "")));

      const cellFontSize = 8.6;
      const padH = 10; // left 5 + right 5
      const padV = 8; // top 4 + bottom 4

      const measureCellSeg = (text: string, seg: InlineSeg) =>
        measureToken(text, seg, cellFontSize, false, false);

      // Compute actual height of header + first body row so tall first rows (e.g. 7-line
      // Q-01 rows) never leave an orphan table header alone at the bottom of a page.
      let firstRowH = 26;
      if (richSegs.length > 0) {
        for (let ci = 0; ci < header.length; ci++) {
          const segs = richSegs[0][ci];
          if (!segs || segs.length === 0) continue;
          const avail = Math.max(20, (colWidths[ci] ?? 80) - padH);
          const laid = layoutInline(segs, avail, measureCellSeg, true);
          const h = richCellHeight(Math.max(1, laid.length), cellFontSize, padV);
          if (h > firstRowH) firstRowH = h;
        }
      }
      ensureSpace(Math.min(180, 26 + firstRowH));

      interface RichCellMeta {
        richSegs?: InlineSeg[];
      }

      autoTable(doc, {
        head,
        body,
        startY: y,
        margin: { top: topMargin, bottom: bottomMargin, left: marginX, right: marginX },
        theme: "grid",
        showHead: "everyPage",
        rowPageBreak: "avoid",
        columnStyles,
        styles: {
          font: fonts.sans,
          fontSize: cellFontSize,
          cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
          textColor: INK,
          lineColor: BORDER_LIGHT,
          lineWidth: 0.5,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          font: fonts.sans,
          fontStyle: "bold",
          fillColor: HEADER_BG,
          textColor: HEADING,
          lineColor: BORDER,
          lineWidth: 0.6,
          halign: "left",
        },
        alternateRowStyles: { fillColor: ZEBRA_BG },
        didParseCell(data) {
          if (data.section !== "body") return;
          const segs = richSegs[data.row.index]?.[data.column.index];
          if (!segs) return;
          (data.cell as unknown as RichCellMeta).richSegs = segs;
          // Compute exact rich-text wrapped height using the final fixed column width
          // BEFORE autoTable runs page-break placement — prevents bottom-margin overflow.
          const colW = colWidths[data.column.index] ?? 80;
          const avail = Math.max(20, colW - padH);
          const laid = layoutInline(segs, avail, measureCellSeg, true);
          data.cell.styles.minCellHeight = richCellHeight(
            Math.max(1, laid.length),
            cellFontSize,
            padV,
          );
        },
        willDrawCell(data) {
          if (data.section !== "body") return;
          const rich = (data.cell as unknown as RichCellMeta).richSegs;
          if (!rich) return;
          data.cell.text = [];
        },
        didDrawCell(data) {
          if (data.section !== "body") return;
          const segs = (data.cell as unknown as RichCellMeta).richSegs;
          if (!segs || segs.length === 0) return;
          const yRestore = y;
          y = data.cell.y + data.cell.padding("top") + cellFontSize * 1.05;
          writeRichText(segs, cellFontSize, {
            color: INK,
            lineHeightRatio: 1.4,
            bounds: {
              left: data.cell.x + data.cell.padding("left"),
              right: data.cell.x + data.cell.width - data.cell.padding("right"),
            },
          });
          y = yRestore;
        },
      });

      const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      y = (lastAutoTable?.finalY ?? y) + 12;
      continue;
    }

    // Horizontal rule
    if (isThematicBreak(trimmed)) {
      drawHorizontalRule();
      continue;
    }

    // Headings with anti-orphan lookahead
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      const headingRaw = headingMatch[2];
      if (depth === 1 && stripInline(headingRaw).trim() === meta.title.trim()) {
        continue;
      }

      const size = depth === 1 ? 17 : depth === 2 ? 14 : depth === 3 ? 11.5 : 10.2;
      const headLineH = size * 1.38;
      const gapBefore = depth === 2 ? 16 : depth === 3 ? 12 : 8;
      const orphanGuard = depth === 2 ? 76 : 64;

      if (y > topMargin + 8) {
        y += gapBefore;
      }
      ensureSpace(headLineH + orphanGuard);

      writeRichText(headingRaw, size, {
        bold: true,
        color: depth <= 2 ? HEADING : SUBHEADING,
        lineHeightRatio: 1.38,
      });

      if (depth === 2) {
        const ruleY = y - headLineH * 0.42;
        setRgbDraw(ACCENT_SOFT);
        doc.setLineWidth(0.75);
        doc.line(marginX, ruleY, marginX + maxWidth, ruleY);
        y = ruleY + 10;
      } else {
        y += 3;
      }

      // WBS bullet tree rendered as rowSpan autoTable; only advance i when bullets exist
      if (depth <= 4 && WBS_SECTION_RE.test(headingRaw)) {
        const { endIdx, block } = collectWbsBlock(rawLines, i + 1, depth);
        const items = parseBulletTree(block);
        if (items.length > 0) {
          i = endIdx - 1;
          ensureSpace(64);
          type PdfCell = string | { content: string; rowSpan: number; styles?: { fontStyle?: "bold" } };
          const body = wbsTableRows(wbsRows(items)).map((r): PdfCell[] => {
            const cells: PdfCell[] = [];
            if (r.module !== null) {
              cells.push({
                content: safeText(r.module),
                rowSpan: r.moduleSpan ?? 1,
                styles: { fontStyle: "bold" },
              });
            }
            if (r.feature !== null) {
              cells.push({ content: safeText(r.feature), rowSpan: r.featureSpan ?? 1 });
            }
            cells.push(safeText(r.sub));
            return cells;
          });

          const w0 = Math.round(maxWidth * 0.25);
          const w1 = Math.round(maxWidth * 0.31);
          const w2 = maxWidth - w0 - w1;

          autoTable(doc, {
            head: [wbsHeaders(language).map(safeText)],
            body,
            startY: y,
            margin: { top: topMargin, bottom: bottomMargin, left: marginX, right: marginX },
            theme: "grid",
            showHead: "everyPage",
            rowPageBreak: "avoid",
            columnStyles: {
              0: { cellWidth: w0 },
              1: { cellWidth: w1 },
              2: { cellWidth: w2 },
            },
            styles: {
              font: fonts.sans,
              fontSize: 8.6,
              cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
              textColor: INK,
              lineColor: BORDER_LIGHT,
              lineWidth: 0.5,
              overflow: "linebreak",
              valign: "middle",
            },
            headStyles: {
              font: fonts.sans,
              fontStyle: "bold",
              fillColor: HEADER_BG,
              textColor: HEADING,
              lineColor: BORDER,
              lineWidth: 0.6,
              halign: "left",
            },
            alternateRowStyles: { fillColor: ZEBRA_BG },
          });

          const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
          y = (lastAutoTable?.finalY ?? y) + 12;

          for (const tl of wbsTailNote(block).split(/\r?\n/)) {
            if (!tl.trim()) continue;
            writeRichText(tl.trim(), 9.8);
            y += 4;
          }
        }
      }
      continue;
    }

    // Nested bullet / ordered lists with vector bullet markers and exact hanging indent
    const listItem = parseListLine(rawLine);
    if (listItem) {
      const baseIndent = 10 + listItem.level * 14;
      if (listItem.kind === "bullet") {
        const textIndent = baseIndent + 12;
        writeRichText(listItem.text, 9.8, {
          indent: textIndent,
          hangingIndent: textIndent,
          onLineStart: (li, lineY) => {
            if (li !== 0) return;
            const cx = marginX + baseIndent + 3;
            const cy = lineY - 3.1;
            if (listItem.level === 0) {
              setRgbFill(ACCENT);
              doc.circle(cx, cy, 1.8, "F");
            } else if (listItem.level === 1) {
              setRgbDraw(MUTED);
              doc.setLineWidth(0.75);
              doc.circle(cx, cy, 1.7, "S");
            } else {
              setRgbDraw(MUTED);
              doc.setLineWidth(0.8);
              doc.line(cx - 2, cy, cx + 2, cy);
            }
          },
        });
      } else {
        doc.setFont(fonts.sans, "bold");
        doc.setFontSize(9.5);
        const markerStr = safeText(listItem.marker);
        const markerW = Math.max(14, doc.getTextWidth(markerStr) + 5);
        const textIndent = baseIndent + markerW;
        writeRichText(listItem.text, 9.8, {
          indent: textIndent,
          hangingIndent: textIndent,
          onLineStart: (li, lineY) => {
            if (li !== 0) return;
            doc.setFont(fonts.sans, "bold");
            doc.setFontSize(9.5);
            setRgbText(ACCENT);
            doc.text(markerStr, marginX + baseIndent, lineY);
          },
        });
      }
      y += 2.5;
      continue;
    }

    // Page-break-safe blockquote (draws warm tint + left accent bar per rendered line)
    const quoteMatch = trimmed.match(/^>\s?(.*)/);
    if (quoteMatch) {
      writeRichText(quoteMatch[1], 9.6, {
        italic: true,
        color: MUTED,
        indent: 18,
        hangingIndent: 18,
        lineHeightRatio: 1.45,
        onLineStart: (_li, lineY, lh) => {
          const stripTop = lineY - lh * 0.72;
          setRgbFill(QUOTE_BG);
          doc.rect(marginX + 6, stripTop, maxWidth - 6, lh, "F");
          setRgbDraw(ACCENT);
          doc.setLineWidth(2);
          doc.line(marginX + 6, stripTop, marginX + 6, stripTop + lh);
        },
      });
      y += 5;
      continue;
    }

    // Keep short lead-in labels (e.g. "Response 200:", "Error:", "Flow / Alur:")
    // attached to the code block / list / table immediately following them.
    if (trimmed.length <= 55 && trimmed.endsWith(":")) {
      ensureSpace(58);
    }

    // Normal paragraph
    writeRichText(trimmed, 9.8, { color: INK, lineHeightRatio: 1.45 });
    y += 5;
  }

  // --- Running Header (pages 2..N) & Page Number Footer (all pages) ---
  const totalPages = doc.getNumberOfPages();
  const pagePrefix = language === "en" ? "Page" : "Halaman";
  const shortHeaderTitle =
    meta.title.length > 76 ? `${meta.title.slice(0, 73)}...` : meta.title;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    if (p > 1) {
      doc.setFont(fonts.sans, "normal");
      doc.setFontSize(7.8);
      setRgbText(MUTED);
      doc.text(safeText(shortHeaderTitle), marginX, 27);
      setRgbDraw(BORDER_LIGHT);
      doc.setLineWidth(0.5);
      doc.line(marginX, 34, marginX + maxWidth, 34);
    }

    // Footer band (always safely below maxY = pageHeight - 54)
    const footerRuleY = pageHeight - 36;
    const footerTextY = pageHeight - 23;
    setRgbDraw(BORDER_LIGHT);
    doc.setLineWidth(0.5);
    doc.line(marginX, footerRuleY, marginX + maxWidth, footerRuleY);

    doc.setFont(fonts.sans, "normal");
    doc.setFontSize(7.8);
    setRgbText(MUTED);
    doc.text("PRD Architect", marginX, footerTextY);

    const pageStr = `${pagePrefix} ${p} / ${totalPages}`;
    const pageStrW = doc.getTextWidth(pageStr);
    doc.text(pageStr, marginX + maxWidth - pageStrW, footerTextY);
  }

  return { doc, fonts };
}

export async function exportPdf(
  content: string,
  productType: string,
  language: "id" | "en" = "id",
): Promise<void> {
  const { doc } = await buildPdfDocument(content, productType, language);
  doc.save(`PRD_${deriveExportSlug(content, productType)}_${Date.now()}.pdf`);
}
