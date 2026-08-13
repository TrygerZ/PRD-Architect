import { get, set, del } from "idb-keyval";
import type { PRDVersion } from "../types";

const KEY_STATE = "PRD_STATE_V1";
const CURRENT_SCHEMA_VERSION = 1;

export interface PersistedState {
  schemaVersion?: number;
  versions: PRDVersion[];
  commentsByVersion: Record<string, Record<string, string>>;
  activeVersionId: string | null;
  savedAt: number;
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await set(KEY_STATE, { ...state, schemaVersion: CURRENT_SCHEMA_VERSION });
  } catch (e) {
    console.warn("Gagal menyimpan riwayat PRD:", e);
  }
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    const data = await get<PersistedState>(KEY_STATE);
    if (!data) return null;

    // Schema migration pipe
    const migrated: PersistedState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      versions: Array.isArray(data.versions) ? data.versions : [],
      commentsByVersion: data.commentsByVersion && typeof data.commentsByVersion === "object" ? data.commentsByVersion : {},
      activeVersionId: typeof data.activeVersionId === "string" ? data.activeVersionId : null,
      savedAt: typeof data.savedAt === "number" ? data.savedAt : Date.now(),
    };
    return migrated;
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
