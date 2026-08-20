// Helper untuk logging terstruktur dengan timestamp + level (BUG 4.11)
// Dipisah ke modul sendiri agar dipakai server.ts dan server/fileExtraction.ts
// tanpa circular import.
export function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level}]`;
  if (data) {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](`${prefix} ${message}`, data);
  } else {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](`${prefix} ${message}`);
  }
}