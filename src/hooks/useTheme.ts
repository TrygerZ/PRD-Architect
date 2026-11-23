import { useState, useEffect, useCallback, useRef } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  resolveTheme,
  type ThemeMode,
} from "../utils/theme";
import { safeGetLocalStorage, safeSetLocalStorage } from "../utils/storage";

/**
 * Manages the active UI theme, persisting changes to localStorage and syncing across tabs.
 */
export function useTheme(): {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    resolveTheme(safeGetLocalStorage(THEME_STORAGE_KEY)),
  );
  const themeRef = useRef<ThemeMode>(theme);
  themeRef.current = theme;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return;
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = resolveTheme(e.newValue);
      themeRef.current = next;
      setThemeState(next);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    const resolved = resolveTheme(next);
    themeRef.current = resolved;
    setThemeState(resolved);
    applyTheme(resolved);
    safeSetLocalStorage(THEME_STORAGE_KEY, resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = themeRef.current === "dark" ? "light" : "dark";
    setTheme(next);
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
