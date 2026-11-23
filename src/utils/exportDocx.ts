// Editorial Print Edition Word (DOCX) exporter built on native `docx` v9 primitives.
// Features A4 margins, custom typography & heading hierarchy with keepNext,
// rich inline formatting across all elements, per-block ordered list resets,
// 3-level nested list indentation, proportional DXA table column widths with
// cantSplit + zebra striping, styled code blocks & blockquotes, and running headers/footers.
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
  inlineRunSpecs,
  isTableSeparator,
  isThematicBreak,
  parseListLine,
  parseTableRow,
  stripHtmlTags,
  stripInline,
  stripYamlFrontmatter,
  triggerDownload,
  wbsHeaders,
  type ParsedTable,
} from "./exportMarkdown";
import { renderAllMermaidCharts, type PngResult } from "./exportMermaid";

// A4 dimensions in twips (1 inch = 1440 twips; 2 cm = 1134 twips)
const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
const MARGIN_TWIPS = 1134;
const CONTENT_WIDTH_TWIPS = A4_WIDTH_TWIPS - MARGIN_TWIPS * 2; // 9638 twips

const FONT_BODY = "Calibri";
const FONT_MONO = "Consolas";

const COLOR_INK = "1F2937";
const COLOR_HEADING = "111827";
const COLOR_SUBHEADING = "1E293B";
const COLOR_MUTED = "64748B";
const COLOR_ACCENT = "8A7047";
const COLOR_ACCENT_SOFT = "D4C3A3";
const COLOR_BORDER = "D1D5DB";
const COLOR_BORDER_LIGHT = "E2E8F0";
const COLOR_HEADER_BG = "EEF2F6";
const COLOR_ZEBRA_BG = "FAFBFD";
const COLOR_CODE_BG = "F6F8FA";
const COLOR_INLINE_CODE_BG = "F1F5F9";
const COLOR_QUOTE_BG = "FAF8F4";

export async function buildDocxDocument(
  content: string,
  productType: string,
  language: "id" | "en" = "id",
  preRenderedCharts?: Map<string, PngResult | null>,
) {
  const chartImageMap = preRenderedCharts ?? (await renderAllMermaidCharts(content));
  const docx = await import("docx");
  const {
    Document,
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
    Header,
    Footer,
    PageNumber,
    LevelFormat,
    TabStopType,
  } = docx;

  const meta = buildExportMeta(content, productType, language);

  const CELL_MARGINS = { top: 90, bottom: 90, left: 130, right: 130 };
  const HEADER_SHADING = { type: ShadingType.SOLID, fill: COLOR_HEADER_BG, color: "auto" } as const;
  const ZEBRA_SHADING = { type: ShadingType.SOLID, fill: COLOR_ZEBRA_BG, color: "auto" } as const;
  const INLINE_CODE_SHADING = {
    type: ShadingType.SOLID,
    fill: COLOR_INLINE_CODE_BG,
    color: "auto",
  } as const;
  const TABLE_BORDERS = {
    top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
    left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
    right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
  };

  const makeInlineRuns = (
    text: string,
    opts: { baseBold?: boolean; baseItalic?: boolean; size?: number; color?: string } = {},
  ) => {
    const size = opts.size ?? 21;
    const color = opts.color ?? COLOR_INK;
    return inlineRunSpecs(text, opts.baseBold ?? false).map(
      (spec) =>
        new TextRun({
          text: spec.text,
          font: spec.code ? FONT_MONO : FONT_BODY,
          size: spec.code ? Math.max(17, size - 2) : size,
          color: spec.code ? COLOR_SUBHEADING : color,
          ...(spec.bold ? { bold: true } : {}),
          ...(spec.italic || opts.baseItalic ? { italics: true } : {}),
          ...(spec.code ? { shading: INLINE_CODE_SHADING } : {}),
        }),
    );
  };

  type DocChild = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: DocChild[] = [];

  // Page 1 Editorial Document Header Block
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: meta.eyebrow,
          font: FONT_BODY,
          bold: true,
          size: 17,
          color: COLOR_ACCENT,
        }),
      ],
      spacing: { before: 0, after: 80 },
      keepNext: true,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: meta.title,
          font: FONT_BODY,
          bold: true,
          size: 40,
          color: COLOR_HEADING,
        }),
      ],
      spacing: { before: 0, after: 100 },
      keepNext: true,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: meta.subtitle,
          font: FONT_BODY,
          size: 19,
          color: COLOR_MUTED,
        }),
      ],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, space: 10, color: COLOR_ACCENT },
      },
      spacing: { before: 0, after: 280 },
    }),
  );

  const makeCodeBlock = (codeLines: string[], lang?: string) => {
    const out: InstanceType<typeof Paragraph>[] = [];
    if (lang) {
      out.push(
        new Paragraph({
          children: [
            new TextRun({
              text: lang.toUpperCase(),
              font: FONT_MONO,
              bold: true,
              size: 15,
              color: COLOR_MUTED,
            }),
          ],
          shading: { type: ShadingType.SOLID, fill: COLOR_HEADER_BG, color: "auto" },
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
            left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
            right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
          },
          indent: { left: 120, right: 120 },
          spacing: { before: 120, after: 0, line: 240 },
          keepNext: true,
        }),
      );
    }

    const bodyLines = codeLines.length > 0 ? codeLines : [""];
    out.push(
      new Paragraph({
        children: bodyLines.map(
          (cl, idx) =>
            new TextRun({
              text: cl,
              font: FONT_MONO,
              size: 18,
              color: COLOR_SUBHEADING,
              break: idx > 0 ? 1 : undefined,
            }),
        ),
        shading: { type: ShadingType.SOLID, fill: COLOR_CODE_BG, color: "auto" },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
          left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
          right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
        },
        indent: { left: 120, right: 120 },
        spacing: { before: lang ? 0 : 100, after: 140, line: 250 },
        keepLines: true,
      }),
    );
    return out;
  };

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

  const rawLines = content.split(/\r?\n/);
  const startIdx = stripYamlFrontmatter(rawLines);
  let orderedListInstance = 0;
  let inOrderedList = false;

  for (let i = startIdx; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const cleanLine = stripHtmlTags(rawLine);
    const trimmed = cleanLine.trim();

    if (trimmed.length === 0) {
      inOrderedList = false;
      continue;
    }

    // Code fence (mermaid vs generic code)
    if (trimmed.startsWith("```")) {
      inOrderedList = false;
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
          const { width: dispW, height: dispH } = computeMermaidDisplaySize(
            png.width,
            png.height,
            560,
            680,
            1.15,
          );
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
              border: {
                top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
                left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
                right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_LIGHT },
              },
              spacing: { before: 140, after: 60 },
              keepNext: true,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: language === "en" ? "Diagram (Mermaid)" : "Diagram (Mermaid)",
                  font: FONT_BODY,
                  italics: true,
                  size: 17,
                  color: COLOR_MUTED,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 160 },
            }),
          );
        } else {
          children.push(...makeCodeBlock(codeLines, "mermaid"));
        }
      } else {
        children.push(...makeCodeBlock(codeLines, lang || undefined));
      }
      continue;
    }

    // Markdown table
    if (trimmed.startsWith("|") && i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1])) {
      inOrderedList = false;
      const table: ParsedTable = { header: parseTableRow(rawLine), rows: [] };
      const { rows: bodyRows, endIdx } = collectTableBodyRows(rawLines, i + 2);
      table.rows = bodyRows;
      i = endIdx - 1;

      const colWidths = computeColumnWeights(
        table.header,
        table.rows,
        CONTENT_WIDTH_TWIPS,
        900,
      );

      const makeCell = (text: string, colWidth: number, isHeader: boolean, isZebra: boolean) =>
        new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: makeInlineRuns(text, {
                baseBold: isHeader,
                size: 19,
                color: isHeader ? COLOR_HEADING : COLOR_INK,
              }),
              spacing: { before: 20, after: 20, line: 260 },
              alignment: AlignmentType.LEFT,
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          margins: CELL_MARGINS,
          shading: isHeader ? HEADER_SHADING : isZebra ? ZEBRA_SHADING : undefined,
        });

      const docRows = [
        new TableRow({
          children: table.header.map((h, ci) =>
            makeCell(h, colWidths[ci] ?? 1600, true, false),
          ),
          tableHeader: true,
          cantSplit: true,
        }),
        ...table.rows.map(
          (r, rowIdx) =>
            new TableRow({
              children: table.header.map((_, ci) =>
                makeCell(r[ci] ?? "", colWidths[ci] ?? 1600, false, rowIdx % 2 === 1),
              ),
              cantSplit: true,
            }),
        ),
      ];

      children.push(
        new Table({
          rows: docRows,
          width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
          columnWidths: colWidths,
          layout: TableLayoutType.FIXED,
          borders: TABLE_BORDERS,
        }),
        new Paragraph({ text: "", spacing: { before: 0, after: 120 } }),
      );
      continue;
    }

    // Horizontal rule (--- / *** / ___ / ===)
    if (isThematicBreak(trimmed)) {
      inOrderedList = false;
      children.push(
        new Paragraph({
          text: "",
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, space: 4, color: COLOR_BORDER_LIGHT },
          },
          spacing: { before: 120, after: 160 },
        }),
      );
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      inOrderedList = false;
      const depth = headingMatch[1].length;
      const headingText = stripInline(headingMatch[2]);

      // Skip redundant top-level H1 if identical to cover header title
      if (depth === 1 && headingText.trim() === meta.title.trim()) {
        continue;
      }

      const headingProps =
        depth === 2
          ? {
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, space: 6, color: COLOR_ACCENT_SOFT },
              },
              spacing: { before: 320, after: 140 },
            }
          : depth === 3
            ? { spacing: { before: 240, after: 90 } }
            : { spacing: { before: 180, after: 70 } };

      children.push(
        new Paragraph({
          heading: headingLevelFor(depth),
          children: [
            new TextRun({
              text: headingText,
              font: FONT_BODY,
              bold: true,
              size: depth === 1 ? 32 : depth === 2 ? 28 : depth === 3 ? 23 : 21,
              color: depth <= 2 ? COLOR_HEADING : COLOR_SUBHEADING,
            }),
          ],
          keepNext: true,
          keepLines: true,
          ...headingProps,
        }),
      );

      // WBS section: render bullet tree as rowSpan table.
      // Only advance `i = endIdx - 1` when bullets are actually parsed so non-bullet
      // WBS sections fall back to normal Markdown rendering without data loss.
      if (depth <= 4 && WBS_SECTION_RE.test(headingMatch[2])) {
        const { endIdx, block } = collectWbsBlock(rawLines, i + 1, depth);
        const items = parseBulletTree(block);
        if (items.length > 0) {
          i = endIdx - 1;
          const wbsColWidths = [
            Math.round(CONTENT_WIDTH_TWIPS * 0.25),
            Math.round(CONTENT_WIDTH_TWIPS * 0.31),
            CONTENT_WIDTH_TWIPS -
              Math.round(CONTENT_WIDTH_TWIPS * 0.25) -
              Math.round(CONTENT_WIDTH_TWIPS * 0.31),
          ];

          const makeWbsCell = (
            text: string,
            colWidth: number,
            bold: boolean,
            rowSpan?: number,
            isHeader = false,
            isZebra = false,
          ) =>
            new TableCell({
              width: { size: colWidth, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text,
                      font: FONT_BODY,
                      bold,
                      size: 19,
                      color: bold ? COLOR_HEADING : COLOR_INK,
                    }),
                  ],
                  spacing: { before: 20, after: 20, line: 260 },
                  alignment: AlignmentType.LEFT,
                }),
              ],
              verticalAlign: VerticalAlign.CENTER,
              margins: CELL_MARGINS,
              shading: isHeader ? HEADER_SHADING : isZebra ? ZEBRA_SHADING : undefined,
              ...(rowSpan && rowSpan > 1 ? { rowSpan } : {}),
            });

          const docRows = [
            new TableRow({
              children: wbsHeaders(language).map((h, ci) =>
                makeWbsCell(h, wbsColWidths[ci], true, undefined, true, false),
              ),
              tableHeader: true,
              cantSplit: true,
            }),
            ...wbsTableRows(wbsRows(items)).map((r, rowIdx) => {
              const cells: InstanceType<typeof TableCell>[] = [];
              const zebra = rowIdx % 2 === 1;
              if (r.module !== null) {
                cells.push(makeWbsCell(r.module, wbsColWidths[0], true, r.moduleSpan, false, false));
              }
              if (r.feature !== null) {
                cells.push(makeWbsCell(r.feature, wbsColWidths[1], false, r.featureSpan, false, false));
              }
              cells.push(makeWbsCell(r.sub, wbsColWidths[2], false, undefined, false, zebra));
              return new TableRow({ children: cells, cantSplit: true });
            }),
          ];

          children.push(
            new Table({
              rows: docRows,
              width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
              columnWidths: wbsColWidths,
              layout: TableLayoutType.FIXED,
              borders: TABLE_BORDERS,
            }),
            new Paragraph({ text: "", spacing: { before: 0, after: 120 } }),
          );

          for (const tl of wbsTailNote(block).split(/\r?\n/)) {
            if (!tl.trim()) continue;
            children.push(
              new Paragraph({
                children: makeInlineRuns(tl.trim()),
                spacing: { after: 90, line: 288 },
              }),
            );
          }
        }
      }
      continue;
    }

    // Nested bullet or ordered list (parsed BEFORE `.trim()` to keep indentation levels)
    const listItem = parseListLine(rawLine);
    if (listItem) {
      if (listItem.kind === "bullet") {
        if (listItem.level === 0) {
          inOrderedList = false;
        }
        children.push(
          new Paragraph({
            children: makeInlineRuns(listItem.text),
            bullet: { level: listItem.level },
            spacing: { after: 60, line: 280 },
          }),
        );
      } else {
        if (!inOrderedList) {
          orderedListInstance += 1;
          inOrderedList = true;
        }
        children.push(
          new Paragraph({
            children: makeInlineRuns(listItem.text),
            numbering: {
              reference: "prd-numbering",
              level: listItem.level,
              instance: orderedListInstance,
            },
            spacing: { after: 60, line: 280 },
          }),
        );
      }
      continue;
    }

    // Blockquote with left accent bar and subtle warm background
    const quoteMatch = trimmed.match(/^>\s?(.*)/);
    if (quoteMatch) {
      inOrderedList = false;
      children.push(
        new Paragraph({
          children: makeInlineRuns(quoteMatch[1], {
            baseItalic: true,
            color: COLOR_MUTED,
          }),
          indent: { left: 260, right: 180 },
          shading: { type: ShadingType.SOLID, fill: COLOR_QUOTE_BG, color: "auto" },
          border: {
            left: { style: BorderStyle.SINGLE, size: 18, space: 10, color: COLOR_ACCENT },
          },
          spacing: { before: 80, after: 100, line: 280 },
        }),
      );
      continue;
    }

    // Normal paragraph with rich inline styling
    inOrderedList = false;
    children.push(
      new Paragraph({
        children: makeInlineRuns(trimmed),
        spacing: { after: 110, line: 288 },
      }),
    );
  }

  const pageLabel = language === "en" ? "Page " : "Halaman ";
  const ofLabel = language === "en" ? " of " : " dari ";

  const makeFooter = () =>
    new Footer({
      children: [
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH_TWIPS }],
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, space: 6, color: COLOR_BORDER_LIGHT },
          },
          children: [
            new TextRun({
              text: "PRD Architect",
              font: FONT_BODY,
              size: 16,
              color: COLOR_MUTED,
            }),
            new TextRun({
              text: `\t${pageLabel}`,
              font: FONT_BODY,
              size: 16,
              color: COLOR_MUTED,
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              font: FONT_BODY,
              size: 16,
              color: COLOR_MUTED,
            }),
            new TextRun({
              text: ofLabel,
              font: FONT_BODY,
              size: 16,
              color: COLOR_MUTED,
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              font: FONT_BODY,
              size: 16,
              color: COLOR_MUTED,
            }),
          ],
        }),
      ],
    });

  const runningHeader = new Header({
    children: [
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, space: 6, color: COLOR_BORDER_LIGHT },
        },
        children: [
          new TextRun({
            text: meta.title,
            font: FONT_BODY,
            size: 16,
            color: COLOR_MUTED,
          }),
        ],
      }),
    ],
  });

  return new Document({
    title: meta.title,
    creator: "PRD Architect",
    styles: {
      default: {
        document: {
          run: {
            font: FONT_BODY,
            size: 21,
            color: COLOR_INK,
          },
          paragraph: {
            spacing: { line: 288, after: 100 },
          },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { font: FONT_BODY, bold: true, size: 32, color: COLOR_HEADING },
          paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, keepLines: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { font: FONT_BODY, bold: true, size: 28, color: COLOR_HEADING },
          paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, keepLines: true },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          run: { font: FONT_BODY, bold: true, size: 23, color: COLOR_SUBHEADING },
          paragraph: { spacing: { before: 240, after: 90 }, keepNext: true, keepLines: true },
        },
        {
          id: "Heading4",
          name: "Heading 4",
          basedOn: "Normal",
          next: "Normal",
          run: { font: FONT_BODY, bold: true, size: 21, color: COLOR_SUBHEADING },
          paragraph: { spacing: { before: 180, after: 70 }, keepNext: true, keepLines: true },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "prd-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 420, hanging: 260 } } },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: "%2.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 820, hanging: 260 } } },
            },
            {
              level: 2,
              format: LevelFormat.LOWER_ROMAN,
              text: "%3.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 1220, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
              header: 560,
              footer: 560,
            },
          },
        },
        headers: {
          first: new Header({ children: [] }),
          default: runningHeader,
        },
        footers: {
          first: makeFooter(),
          default: makeFooter(),
        },
        children,
      },
    ],
  });
}

export async function exportDocx(
  content: string,
  productType: string,
  language: "id" | "en" = "id",
): Promise<void> {
  const docx = await import("docx");
  const doc = await buildDocxDocument(content, productType, language);
  const blob = await docx.Packer.toBlob(doc);
  triggerDownload(blob, `PRD_${deriveExportSlug(content, productType)}_${Date.now()}.docx`);
}
