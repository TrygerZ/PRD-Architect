// Ekstraksi teks dari file upload (PDF/DOCX/XLSX/CSV/image/text) + concurrency
// limiter. Dipisah dari server.ts agar monolit tidak membengkak (pure move).
import fsp from "fs/promises";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { fileTypeFromFile } from 'file-type';
import { sanitizeCellForAI } from "./sanitize";
import { log } from "./log";

const MAX_EXTRACTED_CHARS = 5_000_000; // 5MB extracted text limit — prevents decompression bombs

// V-UPLOAD-04: Concurrency limiter for file parsing — prevents memory exhaustion
// when multiple users upload large files simultaneously
const MAX_CONCURRENT_PARSES = 3;
export let activeParses = 0;
export const parseQueue: Array<() => void> = [];

export function acquireParseSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeParses < MAX_CONCURRENT_PARSES) {
      activeParses++;
      resolve();
    } else {
      parseQueue.push(resolve);
    }
  });
}

export function releaseParseSlot() {
  activeParses--;
  if (parseQueue.length > 0 && activeParses < MAX_CONCURRENT_PARSES) {
    activeParses++;
    const next = parseQueue.shift();
    next!();
  }
}

export async function extractTextFromFile(filePath: string, mimeType: string, originalName: string): Promise<string> {
  const MAX_CHARS = 50000;
  let text = "";

  // Magic bytes verification (defense-in-depth layer 2)
  // Wave 3 — Task 3.4: Reject binary files when type detection fails or returns null
  const binaryMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  const isBinaryFile = binaryMimeTypes.includes(mimeType);

  try {
    const detectedType = await fileTypeFromFile(filePath);
    if (detectedType) {
      const ext = detectedType.ext;
      const validExtensions = ['pdf', 'docx', 'xlsx', 'csv', 'jpg', 'png', 'gif', 'webp'];
      // csv/txt/md may be detected as 'txt' or have no magic bytes — we allow those
      if (!validExtensions.includes(ext) && !['txt', 'csv', 'md'].some(e => originalName.toLowerCase().endsWith('.' + e))) {
        log('WARN', `Magic bytes mismatch: file ${originalName} detected as ${ext}, not in allowed list`);
        return `[SECURITY: File "${originalName}" has mismatched content signature (detected as ${ext}). File rejected.]`;
      }
    } else {
      // fileTypeFromFile returned null — could not detect type
      if (isBinaryFile) {
        log('WARN', `Could not detect file type for binary file ${originalName} (MIME: ${mimeType})`);
        return `[SECURITY: Could not verify file type for "${originalName}". File rejected.]`;
      }
      // For text types, continue (they may not have magic bytes)
    }
  } catch (magicErr) {
    log('WARN', `Magic bytes check error for ${originalName}:`, magicErr);
    // For binary types, reject on error — do NOT skip verification
    if (isBinaryFile) {
      return `[SECURITY: Could not verify file integrity for "${originalName}". File rejected.]`;
    }
    // For text types, continue (they may not have magic bytes)
  }
  try {
    if (mimeType === 'application/pdf') {
      const dataBuffer = await fsp.readFile(filePath);
      // Check compressed file size vs buffer — detect bomb ratio
      if (dataBuffer.length > 0) {
        const stat = await fsp.stat(filePath);
        const compressionRatio = stat.size / dataBuffer.length;
        // If file is highly compressed (ratio > 100), it could be a bomb
        if (compressionRatio > 100) {
          log('WARN', `Suspicious compression ratio for ${originalName}: ${compressionRatio.toFixed(1)}x`);
        }
      }
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText({ first: 10 }); // Limit to 10 pages
      text = result.text;
      // Enforce extracted text limit
      if (text.length > MAX_EXTRACTED_CHARS) {
        log('WARN', `Extracted text from ${originalName} exceeds limit: ${text.length} chars (max ${MAX_EXTRACTED_CHARS})`);
        text = text.substring(0, MAX_EXTRACTED_CHARS) + '\n[TRUNCATED: Content exceeded extraction limit]';
      }
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
      if (text.length > MAX_EXTRACTED_CHARS) {
        log('WARN', `Extracted text from ${originalName} exceeds limit: ${text.length} chars`);
        text = text.substring(0, MAX_EXTRACTED_CHARS) + '\n[TRUNCATED: Content exceeded extraction limit]';
      }
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'text/csv' ||
      originalName.toLowerCase().endsWith('.csv') ||
      originalName.toLowerCase().endsWith('.xlsx') ||
      originalName.toLowerCase().endsWith('.xls')
    ) {
      const workbook = new ExcelJS.Workbook();
      const lowerName = originalName.toLowerCase();

      // BUG 4.12: Deteksi via magic bytes + extension. Cek .xlsx SEBELUM .xls agar tidak salah tangkap.
      const isCSV = mimeType === 'text/csv' || lowerName.endsWith('.csv');
      const isXLS = lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx'); // Pastikan .xls TULEN
      const isXLSX = !isCSV && !isXLS; // Fallback ke XLSX

      if (isCSV) {
        await workbook.csv.readFile(filePath);
      } else if (isXLS) {
        // Old Excel 97-2003 (.xls) — ExcelJS tidak support, beri pesan jelas
        text = `[ERROR: File "${originalName}" menggunakan format XLS lama (Excel 97-2003). Harap konversi ke format XLSX (Excel 2007+) dan unggah ulang.]`;
        return text.substring(0, MAX_CHARS);
      } else {
        await workbook.xlsx.readFile(filePath);
      }

      workbook.worksheets.forEach(worksheet => {
        text += `\n--- Sheet: ${worksheet.name} ---\n`;
        worksheet.eachRow((row) => {
          const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
          text += rowValues.map(v => sanitizeCellForAI(v)).join(',') + '\n';
        });
      });
    } else if (mimeType.startsWith('image/')) {
      text = `[IMAGE: ${originalName}]`;
    } else {
      // Handle text/plain, text/markdown
      const buffer = await fsp.readFile(filePath, { encoding: 'utf-8' });
      text = buffer.substring(0, MAX_CHARS);
    }
  } catch (error) {
    log('ERROR', `Error extracting text from ${originalName}:`, error instanceof Error ? error.message : error);
    text = `[ERROR: Could not extract text from "${originalName}". The file may be corrupted or in an unsupported format.]`;
  }

  return text.substring(0, MAX_CHARS);
}