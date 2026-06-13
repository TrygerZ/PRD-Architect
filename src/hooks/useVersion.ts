import { useState, useCallback } from "react";
import { PRDVersion } from "../types";

export function useVersion() {
  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Task 3.4 — Simpan comments per-versionId, bukan global
  const [commentsByVersion, setCommentsByVersion] = useState<Record<string, Record<string, string>>>({});

  const activeVersion = versions.find((v) => v.id === activeVersionId);

  // Derived: comments untuk versi yang aktif
  const comments = activeVersionId ? (commentsByVersion[activeVersionId] || {}) : {};

  // Setter yang kompatibel dengan tipe Record<string, string> — menyimpan ke versionId aktif
  const setComments = useCallback((value: Record<string, string>) => {
    setCommentsByVersion(prev => {
      if (!activeVersionId) return prev;
      return { ...prev, [activeVersionId]: value };
    });
  }, [activeVersionId]);

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
