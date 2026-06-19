import { getDict, type Dict, type Language } from "../i18n";

// Task 2.2 — Hook ringan untuk mengakses kamus terpusat.
// Pemakaian: const t = useT(language); ... {t.header.copy}
export function useT(language: Language): Dict {
  return getDict(language);
}

export type { Dict };

