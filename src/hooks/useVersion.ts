import { useState, useCallback } from "react";
import { PRDVersion } from "../types";

export function useVersion() {
  const [versions, setVersions] = useState<PRDVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const activeVersion = versions.find((v) => v.id === activeVersionId);

  const handleNewPRD = useCallback((isGenerating: boolean, abortFn: () => void) => {
    if (isGenerating) {
      abortFn();
    }
    setActiveVersionId(null);
    setComments({});
    setVersions([]);
  }, []);

  const handleSwitchVersion = useCallback((vid: string) => {
    setActiveVersionId(vid);
    setComments({});
  }, []);

  const handleCommentChange = useCallback((secId: string, comment: string) => {
    setComments((prev) => {
      const newCom = { ...prev, [secId]: comment };
      if (!comment) delete newCom[secId];
      return newCom;
    });
  }, []);

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
