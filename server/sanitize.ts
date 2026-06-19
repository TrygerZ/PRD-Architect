// Sanitize cell values to prevent formula/prompt injection via Excel/CSV (CRIT-02).
// Extracted from server.ts so it can be unit-tested in isolation.
export function sanitizeCellForAI(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Prefix formula characters that could become prompt injection vectors
  // Characters: =, +, -, @, |, % at the start of a string
  const dangerousPrefixes = ['=', '+', '-', '@', '|', '%'];
  if (dangerousPrefixes.some(prefix => str.startsWith(prefix))) {
    return `'${str}`; // Prefix with single quote to neutralize
  }
  return str;
}
