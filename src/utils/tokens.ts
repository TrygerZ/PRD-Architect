// Task 1.5 — Estimasi token kasar (~4 karakter ≈ 1 token).
// Cukup untuk feedback panjang input/output, bukan billing presisi.
export const estimateTokens = (text: string): number =>
  text ? Math.ceil(text.length / 4) : 0;

// Format ringkas: 1234 -> "1.2k"
export const formatTokenCount = (tokens: number): string => {
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}k`;
};
