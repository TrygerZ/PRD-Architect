/**
 * Safe localStorage wrapper — prevents crashes when:
 * - localStorage is disabled (private browsing in some browsers)
 * - localStorage quota is exceeded
 * - localStorage throws SecurityError in cross-origin iframes
 */

export function safeGetLocalStorage(key: string, fallback: string = ''): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function safeSetLocalStorage(key: string, value: string, onError?: (error: Error) => void): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    if (onError) {
      onError(error);
    }
    // Still silent fail by default, but caller can now handle it
  }
}

/**
 * TTL-aware draft codec — stored as JSON `{ v, t }` (t = save timestamp ms).
 * Backward-compat: nilai lama berupa string polos diperlakukan sebagai draft
 * valid (tanpa TTL). Draft codec — disimpan sebagai JSON `{ v, t }`.
 */
export function serializeDraft(value: string, now: number = Date.now()): string {
  return JSON.stringify({ v: value, t: now });
}

export function parseDraft(raw: string, ttlMs: number, now: number = Date.now()): string {
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw) as { v?: unknown; t?: unknown };
    if (obj && typeof obj.v === "string" && typeof obj.t === "number") {
      return now - obj.t > ttlMs ? "" : obj.v;
    }
  } catch {
    // Nilai lama string polos (bukan JSON) — valid tanpa TTL.
  }
  return raw;
}
