import { useState, useCallback, useRef } from "react";
import { PRDVersion } from "../types";

export function useVersion() {
  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Task 3.4 — Simpan comments per-versionId, bukan global
  const [commentsByVersion, setCommentsByVersion] = useState<Record<string, Record<string, string>>>({});

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
