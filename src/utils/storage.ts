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
