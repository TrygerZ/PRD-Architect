import { en, type Dict } from "./en";
import { id } from "./id";

export type Language = "en" | "id";

export const dicts: Record<Language, Dict> = { en, id };

export function getDict(language: Language): Dict {
  return dicts[language] ?? dicts.en;
}

export type { Dict };

