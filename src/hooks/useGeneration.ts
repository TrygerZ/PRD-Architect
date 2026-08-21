import { useState, useRef, useCallback, useEffect } from "react";
import { generatePRD } from "../services/aiService";
import { ProductType, PRDVersion, UploadedFile, AIProvider, PRDMode } from "../types";
import { getSections } from "../utils/sections";
import { normalizeBrTags } from "../utils/format";

// Task 2.3 — Ekstrak logika generasi (executeGeneration / handleGenerate /
// handleAppend / handleRevise / handleConvertMode) dari App.tsx agar App
// menjadi orchestrator tipis. Semua ref & guard koncurrency dipindah ke sini.

interface UseGenerationArgs {
  customApiKey: string;
  provider: AIProvider;
  model: string;
  customEndpoint?: string;
  uploadedFiles: UploadedFile[];
  // Refs agar handler selalu membaca state terbaru tanpa stale closure.
  // App tetap pemilik state; hook ini hanya meminjam referensi.
  languageRef: React.MutableRefObject<"id" | "en">;
  prdModeRef: React.MutableRefObject<PRDMode>;
  commentsRef: React.MutableRefObject<Record<string, string>>;
  activeVersionRef: React.MutableRefObject<PRDVersion | undefined>;
  // Setters dari useVersion.
  setVersions: React.Dispatch<React.SetStateAction<PRDVersion[]>>;
  setActiveVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  setComments: (value: Record<string, string>) => void;
  setPrdMode?: React.Dispatch<React.SetStateAction<PRDMode>>;
  setProductType?: React.Dispatch<React.SetStateAction<ProductType>>;
}

export function useGeneration({
  customApiKey,
  provider,
  model,
  customEndpoint,
  uploadedFiles,
  languageRef,
  prdModeRef,
  commentsRef,
  activeVersionRef,
  setVersions,
  setActiveVersionId,
  setComments,
  setPrdMode,
  setProductType,
}: UseGenerationArgs) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);
  const connectingRef = useRef(true);

  const abortGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isGeneratingRef.current = false;
    setIsGenerating(false);
    setIsConnecting(false);
  }, []);

  const handleCancel = useCallback(() => {
    abortGeneration();
  }, [abortGeneration]);

  const executeGeneration = useCallback(
    async (
      finalPrompt: string,
      displayPrompt: string,
      mode: "initial" | "append" | "revision",
      productType: ProductType,
      prdMode: PRDMode,
      onSuccess?: () => void,
    ) => {
      // CRIT-05 fix — Guard: reject duplicate calls BEFORE any state changes.
      if (isGeneratingRef.current) {
        return;
      }

      isGeneratingRef.current = true;
      setIsGenerating(true);
      connectingRef.current = true;
      setIsConnecting(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const newVersionId = Date.now().toString();
      const newVersion: PRDVersion = {
        id: newVersionId,
        timestamp: Date.now(),
        content: "",
        prompt: finalPrompt,
        userDisplayPrompt: displayPrompt,
        productType,
        referencedFilesCount: uploadedFiles.length,
        prdMode,
      };

      setVersions((prev) => [...prev, newVersion]);
      setActiveVersionId(newVersionId);
      setComments({});

      const lang = languageRef.current;

      try {
        await generatePRD(
          finalPrompt,
          customApiKey,
          provider,
          model,
          lang,
          productType,
          uploadedFiles,
          mode,
          prdMode,
          controller.signal,
          (chunk) => {
            if (connectingRef.current) {
              connectingRef.current = false;
              setIsConnecting(false);
            }
            setVersions((prev) =>
              prev.map((v) =>
                v.id === newVersionId
                  ? {
                      ...v,
                      content: v.content + (chunk.text ?? ""),
                      reasoning: (v.reasoning ?? "") + (chunk.reasoning ?? ""),
                    }
                  : v,
              ),
            );
          },
          customEndpoint,
        );
        // Titik ingestion tunggal: normalisasi <br> sisa AI sekali di sini,
        // tepat setelah stream selesai disimpan — semua konsumen (website,
        // DetailPanel, export PDF/DOCX/print) membaca versi yang sudah bersih.
        setVersions((prev) => prev.map((v) => (v.id === newVersionId ? { ...v, content: normalizeBrTags(v.content) } : v)));
        onSuccess?.();
      } catch (err: unknown) {
        if (err instanceof Error && (err.name === "AbortError" || err.message === "This operation was aborted")) {
          setIsConnecting(false);
          return;
        }
        const message = err instanceof Error ? err.message : undefined;
        setError(
          message ||
            (lang === "en"
              ? "An unexpected error occurred during PRD generation."
              : "Terjadi kesalahan tidak terduga saat membuat PRD."),
        );
        console.error(err);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          isGeneratingRef.current = false;
          setIsGenerating(false);
          setIsConnecting(false);
        }
      }
    },
    [customApiKey, provider, model, uploadedFiles, setVersions, setActiveVersionId, setComments],
  );

  const handleGenerate = useCallback(
    async (prompt: string, type: ProductType = "Unknown") => {
      setProductType?.(type);
      await executeGeneration(prompt, prompt, "initial", type, prdModeRef.current);
    },
    [executeGeneration, prdModeRef, setProductType],
  );

  const handleAppend = useCallback(
    async (newPrompt: string) => {
      const currentActive = activeVersionRef.current;
      const lang = languageRef.current;
      if (!currentActive) {
        setProductType?.("Unknown");
        setComments({});
        await executeGeneration(newPrompt, newPrompt, "initial", "Unknown", prdModeRef.current);
        return;
      }

      const appendPrompt =
        lang === "en"
          ? `I have an existing PRD. Please ADD the following to it:\n\n### EXISTING PRD:\n${currentActive.content}\n\n### ADDITIONAL REQUEST:\n${newPrompt}`
          : `Saya punya PRD yang sudah ada. Tolong TAMBAHKAN berikut:\n\n### PRD SAAT INI:\n${currentActive.content}\n\n### PERMINTAAN TAMBAHAN:\n${newPrompt}`;

      await executeGeneration(
        appendPrompt,
        newPrompt,
        "append",
        currentActive.productType,
        currentActive.prdMode || "business",
      );
    },
    [executeGeneration, activeVersionRef, languageRef, prdModeRef, setComments, setProductType],
  );

  const handleRevise = useCallback(async () => {
    const currentActive = activeVersionRef.current;
    const currentComments = commentsRef.current;
    const lang = languageRef.current;

    const hasRealComments = Object.values(currentComments).some((c) => c.trim().length > 0);
    if (!currentActive || !hasRealComments) return;

    const parsedSections = getSections(currentActive.content);

    let revisionPrompt =
      lang === "en"
        ? `I want to revise the current PRD based on specific feedback for certain sections.\n\n### Current PRD:\n${currentActive.content}\n\n### Revisions requested per section:\n`
        : `Saya ingin merevisi PRD saat ini berdasarkan feedback spesifik untuk beberapa bagian.\n\n### PRD Saat Ini:\n${currentActive.content}\n\n### Permintaan revisi per bagian:\n`;

    Object.entries(currentComments).forEach(([sectionId, comment]) => {
      let sectionHeading = sectionId;
      const parts = sectionId.split("_");
      const secIdx = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(secIdx)) {
        if (parsedSections[secIdx] && parsedSections[secIdx].heading) {
          sectionHeading = parsedSections[secIdx].heading.substring(0, 60).trim();
        }
      }
      revisionPrompt += `- **${lang === "en" ? "Section" : "Bagian"} "${sectionHeading}"**: ${comment}\n`;
    });
    revisionPrompt +=
      lang === "en"
        ? `\nApply ONLY the revisions listed above. Keep ALL other sections exactly as they are — do not rewrite them.`
        : `\nTerapkan HANYA revisi yang disebutkan di atas. Biarkan SEMUA bagian lainnya persis seperti aslinya — jangan menulis ulang.`;

    await executeGeneration(
      revisionPrompt,
      lang === "en" ? "Revising PRD based on comments..." : "Merevisi PRD berdasarkan komentar...",
      "revision",
      currentActive.productType,
      currentActive.prdMode || "business",
      () => setComments({}),
    );
  }, [executeGeneration, activeVersionRef, commentsRef, languageRef, setComments]);

  const handleConvertMode = useCallback(
    async (targetMode: PRDMode) => {
      const currentActive = activeVersionRef.current;
      const lang = languageRef.current;
      if (!currentActive || isGeneratingRef.current) return;
      if ((currentActive.prdMode || "business") === targetMode) return;

      const MODE_LABEL: Record<PRDMode, { en: string; id: string }> = {
        business: { en: "Business & Investor", id: "Bisnis & Investor" },
        simple: { en: "Simple", id: "Sederhana" },
        technical: { en: "Technical / Developer", id: "Teknis / Developer" },
      };
      const label = lang === "en" ? MODE_LABEL[targetMode].en : MODE_LABEL[targetMode].id;

      const convertPrompt =
        lang === "en"
          ? `Convert the following existing PRD into a ${MODE_LABEL[targetMode].en} PRD. Preserve the core product idea, scope, and key details, but restructure and rewrite it to fully match the target format.\n\n### EXISTING PRD:\n${currentActive.content}`
          : `Konversi PRD berikut menjadi PRD mode ${MODE_LABEL[targetMode].id}. Pertahankan ide produk inti, ruang lingkup, dan detail penting, tetapi susun ulang dan tulis ulang agar sepenuhnya sesuai format target.\n\n### PRD SAAT INI:\n${currentActive.content}`;

      setPrdMode?.(targetMode);
      await executeGeneration(
        convertPrompt,
        lang === "en" ? `Convert to ${label} mode` : `Konversi ke mode ${label}`,
        "initial",
        currentActive.productType,
        targetMode,
      );
    },
    [executeGeneration, activeVersionRef, languageRef, setPrdMode],
  );

  // Abort generation on unmount (cleanup)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    isGenerating,
    isConnecting,
    error,
    setError,
    abortGeneration,
    handleCancel,
    executeGeneration,
    handleGenerate,
    handleAppend,
    handleRevise,
    handleConvertMode,
  };
}
