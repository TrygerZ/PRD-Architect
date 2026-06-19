import { get, set, del } from "idb-keyval";
import type { PRDVersion } from "../types";

const KEY_STATE = "PRD_STATE_V1";

export interface PersistedState {
  versions: PRDVersion[];
  commentsByVersion: Record<string, Record<string, string>>;
  activeVersionId: string | null;
  savedAt: number;
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await set(KEY_STATE, state);
  } catch (e) {
    console.warn("Gagal menyimpan riwayat PRD:", e);
  }
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    return (await get<PersistedState>(KEY_STATE)) ?? null;
  } catch {
    return null;
  }
}

export async function clearState(): Promise<void> {
  try {
    await del(KEY_STATE);
  } catch (e) {
    console.warn("Gagal menghapus riwayat PRD:", e);
  }
}
