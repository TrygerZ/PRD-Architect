import { useState, useCallback, useRef, useEffect } from "react";
import { PRDVersion } from "../types";
import { saveState, loadState, clearState, createSyncChannel, SyncMessage } from "../utils/persistence";

export function useVersion(onSaveError?: (reason: "quota" | "error") => void) {
  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Task 3.4 — Simpan comments per-versionId, bukan global
  const [commentsByVersion, setCommentsByVersion] = useState<Record<string, Record<string, string>>>({});

  // Task 1.1 — Persistensi riwayat PRD ke IndexedDB.
  // restored: true setelah upaya restore selesai, agar autosave tidak menimpa
  // state tersimpan dengan state awal kosong sebelum data dimuat.
  const restoredRef = useRef(false);

  // D-01c — callback via ref agar autosave effect tak perlu re-run saat berubah.
  // Keep onSaveError in a ref so the autosave effect deps stay stable.
  const onSaveErrorRef = useRef(onSaveError);
  onSaveErrorRef.current = onSaveError;

  // D-02b — Tab ID unik per instance hook untuk mendeteksi & mengabaikan echo pesan sendiri.
  // Unique tab ID per session to avoid self-echoes in BroadcastChannel.
  const tabIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  );

  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastSavedAtRef = useRef<number>(0);
  const lastSavedVersionsRef = useRef<PRDVersion[]>(versions);
  const lastSavedCommentsRef = useRef<Record<string, Record<string, string>>>(commentsByVersion);
  const lastSavedActiveIdRef = useRef<string | null>(activeVersionId);

  // Keep latest state in refs for sync comparisons and callbacks
  const versionsRef = useRef(versions);
  versionsRef.current = versions;
  const commentsByVersionRef = useRef(commentsByVersion);
  commentsByVersionRef.current = commentsByVersion;
  const activeVersionIdRef = useRef(activeVersionId);
  activeVersionIdRef.current = activeVersionId;

  // D-02b — Setup BroadcastChannel untuk sinkronisasi antar-tab.
  // Listen for state changes in other tabs and refresh local state without looping.
  useEffect(() => {
    const channel = createSyncChannel();
    if (!channel) return;
    channelRef.current = channel;

    const handleMessage = async (event: MessageEvent<SyncMessage>) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.senderId === tabIdRef.current) return;

      if (data.type === "SAVED") {
        if (typeof data.savedAt === "number" && data.savedAt <= lastSavedAtRef.current) {
          return;
        }

        // Jangan timpa jika tab ini memiliki unpersisted edits lokal yang sedang menunggu save
        const hasLocalEdits =
          versionsRef.current !== lastSavedVersionsRef.current ||
          commentsByVersionRef.current !== lastSavedCommentsRef.current ||
          activeVersionIdRef.current !== lastSavedActiveIdRef.current;
        if (hasLocalEdits) return;

        const fresh = await loadState();
        if (!fresh) return;
        if (typeof fresh.savedAt === "number" && fresh.savedAt <= lastSavedAtRef.current) {
          return;
        }

        lastSavedAtRef.current = fresh.savedAt;
        const newVersions = fresh.versions ?? [];
        const newComments = fresh.commentsByVersion ?? {};
        const newActiveId = fresh.activeVersionId ?? null;

        lastSavedVersionsRef.current = newVersions;
        lastSavedCommentsRef.current = newComments;
        lastSavedActiveIdRef.current = newActiveId;

        setVersions(newVersions);
        setCommentsByVersion(newComments);
        setActiveVersionId(newActiveId);
      } else if (data.type === "CLEARED") {
        if (typeof data.savedAt === "number" && data.savedAt <= lastSavedAtRef.current) {
          return;
        }
        lastSavedAtRef.current = data.savedAt || Date.now();
        const emptyVersions: PRDVersion[] = [];
        const emptyComments: Record<string, Record<string, string>> = {};

        lastSavedVersionsRef.current = emptyVersions;
        lastSavedCommentsRef.current = emptyComments;
        lastSavedActiveIdRef.current = null;

        setVersions(emptyVersions);
        setCommentsByVersion(emptyComments);
        setActiveVersionId(null);
      }
    };

    channel.onmessage = handleMessage;

    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadState().then((s) => {
      if (!cancelled && s) {
        if (s.versions?.length) {
          setVersions(s.versions);
          lastSavedVersionsRef.current = s.versions;
        }
        if (s.commentsByVersion) {
          setCommentsByVersion(s.commentsByVersion);
          lastSavedCommentsRef.current = s.commentsByVersion;
        }
        if (s.activeVersionId) {
          setActiveVersionId(s.activeVersionId);
          lastSavedActiveIdRef.current = s.activeVersionId;
        }
        if (typeof s.savedAt === "number") {
          lastSavedAtRef.current = s.savedAt;
        }
      }
      restoredRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Autosave (debounce 800ms) saat versions/comments/activeVersion berubah.
  // Catatan durabilitas: saveState bersifat async (IndexedDB), jadi save pada
  // unload bersifat best-effort. visibilitychange (hidden) dipakai untuk memicu
  // save lebih awal sebelum tab benar-benar ditutup.
  // Durability note: idb saveState is async, so unload save is best-effort;
  // visibilitychange(hidden) triggers an earlier, more reliable save.
  useEffect(() => {
    if (!restoredRef.current) return;

    // D-02b — Lewati save bila state saat ini identik dengan yang terakhir disimpan/disinkronkan.
    // Mencegah redundant write & infinite loop antar-tab.
    const isSameAsPersisted =
      versions === lastSavedVersionsRef.current &&
      commentsByVersion === lastSavedCommentsRef.current &&
      activeVersionId === lastSavedActiveIdRef.current;
    if (isSameAsPersisted) return;

    const doSave = async () => {
      const now = Date.now();
      lastSavedAtRef.current = now;
      lastSavedVersionsRef.current = versions;
      lastSavedCommentsRef.current = commentsByVersion;
      lastSavedActiveIdRef.current = activeVersionId;

      const res = await saveState({
        versions,
        commentsByVersion,
        activeVersionId,
        savedAt: now,
      });
      if (!res.ok) {
        onSaveErrorRef.current?.(res.reason);
      } else {
        // D-02b — Notifikasi tab lain setelah penyimpanan berhasil
        channelRef.current?.postMessage({
          type: "SAVED",
          savedAt: now,
          senderId: tabIdRef.current,
        });
      }
    };

    const t = setTimeout(() => {
      void doSave();
    }, 800);

    const handleBeforeUnload = () => {
      void doSave();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void doSave();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [versions, commentsByVersion, activeVersionId]);

  const activeVersion = versions.find((v) => v.id === activeVersionId);

  // Derived: comments untuk versi yang aktif
  const comments = activeVersionId ? (commentsByVersion[activeVersionId] || {}) : {};

  // BUG-06 fix — setComments reference STABIL (empty deps).
  // Menggunakan ref untuk mengakses activeVersionId terbaru, sehingga
  // reference tidak berubah saat version switch → React.memo di child components tetap efektif.
  const setComments = useCallback((value: Record<string, string>) => {
    setCommentsByVersion(prev => {
      const currentId = activeVersionIdRef.current;
      if (!currentId) return prev;
      return { ...prev, [currentId]: value };
    });
  }, []);

  const handleNewPRD = useCallback((isGenerating: boolean, abortFn: () => void) => {
    if (isGenerating) {
      abortFn();
    }
    const emptyVersions: PRDVersion[] = [];
    const emptyComments: Record<string, Record<string, string>> = {};
    const now = Date.now();
    lastSavedVersionsRef.current = emptyVersions;
    lastSavedCommentsRef.current = emptyComments;
    lastSavedActiveIdRef.current = null;
    lastSavedAtRef.current = now;

    setActiveVersionId(null);
    setCommentsByVersion(emptyComments);
    setVersions(emptyVersions);
    // Task 1.1 — Hapus riwayat tersimpan saat user memulai PRD baru
    clearState();
    // D-02b — Beritahu tab lain bahwa state telah direset
    channelRef.current?.postMessage({
      type: "CLEARED",
      savedAt: now,
      senderId: tabIdRef.current,
    });
  }, []);

  const handleSwitchVersion = useCallback((vid: string) => {
    setActiveVersionId(vid);
    // Comments untuk vid akan otomatis di-load via derived `comments`
  }, []);

  const handleCommentChange = useCallback((secId: string, comment: string) => {
    setCommentsByVersion((prev) => {
      if (!activeVersionId) return prev;
      const currentComments = prev[activeVersionId] || {};
      const newCom = { ...currentComments, [secId]: comment };
      if (!comment) delete newCom[secId];
      return { ...prev, [activeVersionId]: newCom };
    });
  }, [activeVersionId]);

  return {
    versions,
    setVersions,
    activeVersionId,
    setActiveVersionId,
    activeVersion,
    comments,
    setComments,
    handleNewPRD,
    handleSwitchVersion,
    handleCommentChange,
  };
}
