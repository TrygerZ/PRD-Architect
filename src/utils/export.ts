// Export facade for PRD -> DOCX, PDF, and structured JSON.
// Shared Markdown layout helpers live in exportMarkdown.ts; DOCX lives in exportDocx.ts;
// Mermaid PNG rasterization lives in exportMermaid.ts.
import { getSections, type Section } from "./sections";
import { parseBulletTree } from "./wbs";
import { WBS_SECTION_RE, wbsRows, wbsTableRows, wbsTailNote } from "./wbsTable";
import {
  collectTableBodyRows,
  collectWbsBlock,
  computeMermaidDisplaySize,
  fenceLang,
  isTableSeparator,
  isThematicBreak,
  layoutInline,
  parseInline,
  parseTableRow,
  richCellHeight,
  sanitizeFilename,
  stripInline,
  triggerDownload,
  wbsHeaders,
  type InlineSeg,
} from "./exportMarkdown";
import { renderAllMermaidCharts } from "./exportMermaid";

export {
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
  type InlineSeg,
  type RunSpec,
  type ParsedListItem,
  type ExportDocMeta,
} from "./exportMarkdown";
export { exportDocx, buildDocxDocument } from "./exportDocx";

function normalizePdfText(s: string): string {
  return s
    .replace(/[\u2500\u2501\u2504\u2505\u2506\u2507\u2508\u2509\u250A\u250B\u254C\u254D]/g, "-")
    .replace(/[\u2502\u2503\u2507\u250E\u250F\u254E\u254F]/g, "|")
    .replace(/[\u250C\u250D\u2510\u2511\u2514\u2515\u2518\u2519\u251C\u251D\u251E\u251F\u2520\u2521\u2522\u2523\u2524\u2525\u2526\u2527\u2528\u2529\u252A\u252B\u252C\u252D\u252E\u252F\u2530\u2531\u2532\u2533\u2534\u2535\u2536\u2537\u2538\u2539\u253A\u253B\u253C\u253D\u253E\u253F\u2540\u2541\u2542\u2543\u2544\u2545\u2546\u2547\u2548\u2549\u254A\u254B]/g, "+")
    .replace(/\u2550/g, "=")
    .replace(/\u2551/g, "|")
    .replace(/[\u2022\u25CF\u25CB]/g, "*")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019\u201A\u2032\u02B9]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033\u02BA]/g, '"')
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2191/g, "^")
    .replace(/\u2193/g, "v")
    .replace(/\u21D2/g, "=>")
    .replace(/\u21D0/g, "<=")
    .replace(/\u00A0/g, " ")
    .replace(/\u00B0/g, " deg")
    .replace(/\u00B1/g, "+/-")
    .replace(/\u00D7/g, "x")
    .replace(/\u00F7/g, "/")
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u2260/g, "!=")
    .replace(/\u2248/g, "~=")
    .replace(/\u20AC/g, "EUR")
    .replace(/\u00A9/g, "(c)")
    .replace(/\u00AE/g, "(R)")
    .replace(/\u2122/g, "TM")
    .replace(/[^\x20-\x7E\r\n\t]/g, "");
}

function fontStyleFor(seg: InlineSeg, baseBold: boolean, baseItalic: boolean): [string, string] {
  const bold = baseBold || !!seg.bold;
  const italic = baseItalic || !!seg.italic;
  return [
    seg.code ? "courier" : "helvetica",
    bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal",
  ];
}

// --- PDF (client-side via jsPDF + autoTable) --------------------------------

export async function exportPdf(content: string, productType: string, language: "id" | "en" = "id"): Promise<void> {
  const chartImageMap = await renderAllMermaidCharts(content);
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
    const safe = normalizePdfText(text);
    const wrapped = doc.splitTextToSize(safe, maxWidth - indent) as string[];
    const lineHeight = fontSize * 1.4;
    for (const w of wrapped) {
      ensureSpace(lineHeight);
      doc.text(w, margin + indent, y);
      y += lineHeight;
    }
  };

  const measureSeg = (text: string, seg: InlineSeg): number => {
    const [family, style] = fontStyleFor(seg, false, false);
    doc.setFont(family, style);
    return doc.getTextWidth(normalizePdfText(text));
  };

  const writeRichText = (
    textOrSegs: string | InlineSeg[],
    fontSize: number,
    opts: {
      bold?: boolean;
      italic?: boolean;
      indent?: number;
      hangingIndent?: number;
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
    const contWidth = opts.bounds ? undefined : rightEdge - (margin + hangIndent);
    doc.setFontSize(fontSize);

    const measure = (text: string, seg: InlineSeg): number => {
      const [family, style] = fontStyleFor(seg, baseBold, baseItalic);
      doc.setFont(family, style);
      return doc.getTextWidth(normalizePdfText(text));
    };
    const segs = Array.isArray(textOrSegs) ? textOrSegs : parseInline(textOrSegs);
    const lines = layoutInline(segs, rightEdge - leftEdge, measure, inCell, contWidth);
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

  let startIdx = 0;
  if (lines[0]?.trim() === "---") {
    startIdx = 1;
    while (startIdx < lines.length && lines[startIdx].trim() !== "---") {
      startIdx++;
    }
    startIdx++;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
      .trim();

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
        const png = chartImageMap.get(chartCode) ?? null;
        if (png) {
          const maxH = pageHeight - margin * 2;
          const { width: dispW, height: dispH } = computeMermaidDisplaySize(
            png.width,
            png.height,
            maxWidth,
            maxH,
            1.15,
          );
          ensureSpace(dispH + 10);
          const x = margin + (maxWidth - dispW) / 2;
          doc.addImage(png.dataUrl, "PNG", x, y, dispW, dispH);
          y += dispH + 12;
        } else {
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

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseTableRow(line);
      const { rows: bodyRows, endIdx } = collectTableBodyRows(lines, i + 2);
      i = endIdx - 1;

      const head = [header.map((c) => normalizePdfText(stripInline(c)))];
      const body = bodyRows.map((r) => r.map((c) => normalizePdfText(stripInline(c))));
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
          const padV = data.cell.padding("top") + data.cell.padding("bottom");
          data.cell.styles.minCellHeight = richCellHeight(1, 9, padV);
        },
        willDrawCell(data) {
          const rich = (data.cell as unknown as RichCell).richSegs;
          if (!rich) return;
          data.cell.text = [];

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
          y = data.cell.y + padTop + 9 * 1.05;
          writeRichText(segs, 9, {
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

    if (isThematicBreak(trimmed)) {
      drawHorizontalRule();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      const size = depth === 1 ? 22 : depth === 2 ? 18 : depth === 3 ? 14 : 12;
      const headLineH = size * 1.4;
      y += depth === 2 ? 18 : depth === 3 ? 14 : 10;
      ensureSpace(headLineH + 12);
      const yBefore = y;
      writeRichText(headingMatch[2], size, { bold: true });
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

      if (depth <= 4 && WBS_SECTION_RE.test(headingMatch[2])) {
        const { endIdx, block } = collectWbsBlock(lines, i + 1, depth);
        const items = parseBulletTree(block);
        if (items.length > 0) {
          i = endIdx - 1;
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

    writeRichText(trimmed, 11);
    y += 6;
  }

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
