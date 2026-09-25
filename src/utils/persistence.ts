import { get, set, del, update } from "idb-keyval";
import type { PRDVersion } from "../types";

const KEY_STATE = "PRD_STATE_V1";
const CURRENT_SCHEMA_VERSION = 1;

// D-02b — Channel name & message type untuk sinkronisasi antar-tab via BroadcastChannel.
// Cross-tab sync channel name and message contract.
export const SYNC_CHANNEL_NAME = "PRD_TAB_SYNC";

export interface SyncMessage {
  type: "SAVED" | "CLEARED";
  savedAt: number;
  senderId: string;
}

export function createSyncChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch {
    return null;
  }
}

// D-01b — Batasi jumlah versi yang dipersist agar tidak unbounded (quota).
// Cap the number of persisted versions to avoid unbounded growth / quota.
export const MAX_PERSISTED_VERSIONS = 50;

export interface PersistedState {
  schemaVersion?: number;
  versions: PRDVersion[];
  commentsByVersion: Record<string, Record<string, string>>;
  activeVersionId: string | null;
  savedAt: number;
}

export type SaveResult = { ok: true } | { ok: false; reason: "quota" | "error" };

// D-03 — Validator per-PRDVersion: buang elemen yang bentuknya tidak valid.
// Reject elements whose shape is not a valid PRDVersion.
export function isValidVersion(v: unknown): v is PRDVersion {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.content === "string" && typeof o.timestamp === "number";
}

function isQuotaError(e: unknown): boolean {
  if (e instanceof DOMException) {
    if (e.code === 22 || e.name === "QuotaExceededError") return true;
  }
  const name = (e as { name?: string })?.name;
  return typeof name === "string" && name.includes("Quota");
}

// D-01b / D-01d — Batasi array versi: ambil N versi terbaru + pastikan activeVersion
// tetap termasuk. Fungsi murni agar dapat dipakai untuk in-memory & persistensi.
// Keep the newest N versions, always include the active one. Pure helper for memory & persistence.
export function capVersions(
  versions: PRDVersion[],
  activeVersionId: string | null,
  limit = MAX_PERSISTED_VERSIONS,
): PRDVersion[] {
  if (limit <= 0) return [];
  const valid = versions.filter(isValidVersion);
  if (valid.length <= limit) return valid;

  let kept = valid.slice(-limit);
  if (
    activeVersionId &&
    valid.some((v) => v.id === activeVersionId) &&
    !kept.some((v) => v.id === activeVersionId)
  ) {
    const active = valid.find((v) => v.id === activeVersionId)!;
    kept = [active, ...kept.slice(1)];
  }
  return kept;
}

// D-01b / D-03 — Ambil N versi terbaru (slice ekor) + pastikan activeVersion
// tetap termasuk, lalu buang komentar orphan. Fungsi murni agar mudah dites.
// Keep the newest N versions, always include the active one, drop orphan comments.
export function capState(state: PersistedState): PersistedState {
  const kept = capVersions(state.versions, state.activeVersionId ?? null, MAX_PERSISTED_VERSIONS);
  const keptIds = new Set(kept.map((v) => v.id));
  const commentsByVersion: Record<string, Record<string, string>> = {};
  for (const [id, c] of Object.entries(state.commentsByVersion || {})) {
    if (keptIds.has(id)) commentsByVersion[id] = c;
  }
  return { ...state, versions: kept, commentsByVersion };
}

// D-02 — Last-writer-wins berbasis savedAt: hanya timpa bila incoming lebih baru
// atau sama, untuk mencegah tab dengan snapshot lama menimpa tab yang lebih baru.
// Only overwrite when incoming.savedAt >= existing.savedAt (multi-tab race guard).
function resolveWrite(existing: PersistedState | undefined, incoming: PersistedState): PersistedState {
  if (existing && typeof existing.savedAt === "number" && incoming.savedAt < existing.savedAt) {
    return existing;
  }
  return capState(incoming);
}

export async function saveState(state: PersistedState): Promise<SaveResult> {
  const stamped: PersistedState = { ...state, schemaVersion: CURRENT_SCHEMA_VERSION };
  try {
    // D-02 — read-modify-write atomik via update.
    await update<PersistedState>(KEY_STATE, (existing) => resolveWrite(existing, stamped));
    return { ok: true };
  } catch (e) {
    if (isQuotaError(e)) {
      // D-01a — jangan telan senyap; beri sinyal ke caller agar bisa surface ke UI.
      return { ok: false, reason: "quota" };
    }
    console.warn("Gagal menyimpan riwayat PRD:", e);
    return { ok: false, reason: "error" };
  }
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    const data = await get<PersistedState>(KEY_STATE);
    if (!data) return null;

    // D-03 — best-effort load: validasi tiap versi, buang yang invalid,
    // buang komentar orphan, dan jangan crash pada schemaVersion lebih baru.
    const rawVersions = Array.isArray(data.versions) ? data.versions.filter(isValidVersion) : [];
    const activeVersionId = typeof data.activeVersionId === "string" ? data.activeVersionId : null;
    const rawComments =
      data.commentsByVersion && typeof data.commentsByVersion === "object" ? data.commentsByVersion : {};
    const ids = new Set(rawVersions.map((v) => v.id));
    const commentsByVersion: Record<string, Record<string, string>> = {};
    for (const [id, c] of Object.entries(rawComments)) {
      if (ids.has(id)) commentsByVersion[id] = c;
    }

    const migrated: PersistedState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      versions: rawVersions,
      commentsByVersion,
      activeVersionId,
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
