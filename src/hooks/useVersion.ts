import { useState, useCallback, useRef, useEffect } from "react";
import { PRDVersion } from "../types";
import { saveState, loadState, clearState } from "../utils/persistence";

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

  useEffect(() => {
    let cancelled = false;
    loadState().then((s) => {
      if (!cancelled && s) {
        if (s.versions?.length) setVersions(s.versions);
        if (s.commentsByVersion) setCommentsByVersion(s.commentsByVersion);
        if (s.activeVersionId) setActiveVersionId(s.activeVersionId);
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
    const doSave = async () => {
      const res = await saveState({
        versions,
        commentsByVersion,
        activeVersionId,
        savedAt: Date.now(),
      });
      if (!res.ok) onSaveErrorRef.current?.(res.reason);
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

  // BUG-06 fix — Ref yang selalu sinkron dengan activeVersionId terbaru,
  // sehingga setComments tidak perlu activeVersionId di dependency array.
  const activeVersionIdRef = useRef(activeVersionId);
  activeVersionIdRef.current = activeVersionId;

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
    setActiveVersionId(null);
    setCommentsByVersion({});
    setVersions([]);
    // Task 1.1 — Hapus riwayat tersimpan saat user memulai PRD baru
    clearState();
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
