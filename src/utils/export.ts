// Thin public facade for PRD export (DOCX, PDF, structured JSON).
// Implementation lives in focused modules: exportMarkdown.ts, exportMermaid.ts,
// exportDocx.ts, pdfFonts.ts, and exportPdf.ts.
import { getSections, type Section } from "./sections";
import { sanitizeFilename, triggerDownload } from "./exportMarkdown";

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
export { exportPdf, buildPdfDocument } from "./exportPdf";
export { normalizePdfText, woffToTtf } from "./pdfFonts";

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
