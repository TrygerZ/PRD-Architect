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

export function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage penuh atau disabled — silent fail
  }
}
