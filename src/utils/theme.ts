import { safeGetLocalStorage } from "./storage";

export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "PRD_THEME";

const THEME_COLORS: Record<ThemeMode, string> = {
  dark: "#08090C",
  light: "#E2E4E9",
};

/**
 * Resolves a raw persisted theme string into a valid ThemeMode, defaulting to "dark".
 */
export function resolveTheme(raw: string | null | undefined): ThemeMode {
  return raw === "light" ? "light" : "dark";
}

/**
 * Applies the active theme to the document root and theme-color meta tag.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  if (document.documentElement?.dataset) {
    document.documentElement.dataset.theme = theme;
  }
  const metaThemeColor = document.querySelector?.('meta[name="theme-color"]');
  if (metaThemeColor) {
    const color = THEME_COLORS[theme];
    if (typeof metaThemeColor.setAttribute === "function") {
      metaThemeColor.setAttribute("content", color);
    } else if ("content" in metaThemeColor) {
      (metaThemeColor as HTMLMetaElement).content = color;
    }
  }
}

/**
 * Reads the persisted theme safely and applies it to the document.
 */
export function initTheme(): ThemeMode {
  const theme = resolveTheme(safeGetLocalStorage(THEME_STORAGE_KEY));
  applyTheme(theme);
  return theme;
}
