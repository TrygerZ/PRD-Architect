import { useState, useEffect, useRef, useMemo, memo } from "react";
import DOMPurify from "dompurify";
import { Code2, Eye, Copy, Check, Maximize2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { sanitizeMermaid } from "../utils/mermaid";
import type { ThemeMode } from "../utils/theme";
import { MODAL_SLIDE_UP } from "../utils/motion";
import { useT } from "../hooks/useT";

type MermaidModule = typeof import("mermaid");
let lastInitializedTheme: ThemeMode | null = null;
let mermaidModule: MermaidModule | null = null;

async function getMermaidModule(): Promise<MermaidModule> {
  if (!mermaidModule) {
    mermaidModule = await import("mermaid");
  }
  return mermaidModule;
}

const DARK_THEME_VARS: Record<string, string> = {
  background: "#0A0C10",
  primaryColor: "#181C24",
  primaryTextColor: "#EAECEF",
  primaryBorderColor: "#B89E74",
  lineColor: "#A6ADBA",
  secondaryColor: "#12151B",
  tertiaryColor: "#1F242F",
  mainBkg: "#181C24",
  nodeBorder: "#B89E74",
  clusterBkg: "#12151B",
  titleColor: "#EAECEF",
  edgeLabelBackground: "#12151B",
};

const LIGHT_THEME_VARS: Record<string, string> = {
  background: "#D8DBE2",
  primaryColor: "#F2F3F5",
  primaryTextColor: "#0E1015",
  primaryBorderColor: "#7E643E",
  lineColor: "#4D5361",
  secondaryColor: "#EAEBEF",
  tertiaryColor: "#F6F7F9",
  mainBkg: "#F2F3F5",
  nodeBorder: "#7E643E",
  clusterBkg: "#EAEBEF",
  titleColor: "#0E1015",
  edgeLabelBackground: "#F2F3F5",
};

export interface MermaidRendererProps {
  chart: string;
  isGenerating?: boolean;
  theme?: ThemeMode;
  language?: "id" | "en";
}

export const MermaidRenderer = memo(function MermaidRenderer({
  chart,
  isGenerating = false,
  theme = "dark",
  language = "en",
}: MermaidRendererProps) {
  const t = useT(language);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  const sanitizedChart = useMemo(() => sanitizeMermaid(chart), [chart]);
  const containerId = useRef(
    `mermaid-${Math.random().toString(36).substring(2, 11)}`,
  );
  const renderSeqRef = useRef(0);
  const svgRef = useRef<string | null>(null);
  const lastRenderTimeRef = useRef(0);
  const lastRenderedThemeRef = useRef<ThemeMode | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!zoomOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [zoomOpen]);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      // MRD-14: Stale-while-revalidate — keep showing previous
      // SVG/diagram while re-rendering. Only show loading on first render.
      if (!svgRef.current) {
        setStatus("loading");
      }
      setError(null);

      try {
        const mermaid = await getMermaidModule();
        if (cancelled) return;

        if (lastInitializedTheme !== theme) {
          mermaid.default.initialize({
            startOnLoad: false,
            theme: theme === "dark" ? "dark" : "neutral",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            securityLevel: "strict",
            htmlLabels: false,
            themeVariables:
              theme === "dark" ? DARK_THEME_VARS : LIGHT_THEME_VARS,
          });
          lastInitializedTheme = theme;
        }

        // MRD-09: Pre-processing — normalize input before render
        const normalized = sanitizedChart
          .replace(/^\uFEFF/, "")
          .replace(/\r\n/g, "\n")
          .replace(/^\n+/, "")
          .replace(/\n+$/, "\n");

        // MRD-10: Pre-validate with mermaid.parse() for early error detection
        try {
          await mermaid.default.parse(normalized);
        } catch (parseErr) {
          const msg =
            parseErr instanceof Error ? parseErr.message : String(parseErr);
          throw new Error(`Parse error: ${msg}`);
        }

        // Container off-screen position:fixed mencegah mermaid.render()
        // menyisipkan <div> in-flow ke document.body (yang mengubah
        // scrollHeight -> viewport bergeser -> layar bergetar).
        const host = document.createElement("div");
        host.style.cssText =
          "position:fixed;left:-99999px;top:0;width:auto;height:auto;overflow:hidden;pointer-events:none;z-index:-1;opacity:0;";
        document.body.appendChild(host);
        let renderedSvg: string;
        const renderId = `${containerId.current}-${renderSeqRef.current++}`;
        try {
          ({ svg: renderedSvg } = await mermaid.default.render(
            renderId,
            normalized,
            host,
          ));
        } finally {
          host.remove();
        }
        if (cancelled) return;

        const sanitizedSvg = DOMPurify.sanitize(renderedSvg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ["script", "iframe", "object", "embed"],
        });
        svgRef.current = sanitizedSvg;
        lastRenderTimeRef.current = Date.now();
        lastRenderedThemeRef.current = theme;
        setSvg(sanitizedSvg);
        setStatus("success");
      } catch (err) {
        if (cancelled) return;
        // MRD-14: Only show error if no previous successful render
        if (!svgRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram",
          );
          setStatus("error");
        }
      }
    }

    // MRD-16: Throttle during streaming — max 1 render every 2s.
    // Theme switches bypass the 2s throttle to keep live dark/light switching crisp.
    clearTimeout(throttleRef.current);
    const now = Date.now();
    const sinceLast = now - lastRenderTimeRef.current;
    const isThemeSwitch =
      lastRenderedThemeRef.current !== null &&
      lastRenderedThemeRef.current !== theme;

    if (isThemeSwitch || !isGenerating) {
      throttleRef.current = setTimeout(() => {
        if (!cancelled) renderDiagram();
      }, 0);
    } else if (sinceLast < 2000) {
      throttleRef.current = setTimeout(() => {
        if (!cancelled) renderDiagram();
      }, 2000 - sinceLast);
    } else {
      throttleRef.current = setTimeout(() => {
        if (!cancelled) renderDiagram();
      }, 100);
    }

    return () => {
      cancelled = true;
      clearTimeout(throttleRef.current);
    };
  }, [sanitizedChart, isGenerating, theme]);

  const handleCopySource = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="oa-recessed-well flex items-center gap-3 p-4 my-5 rounded-xl min-h-[80px]">
        <div className="w-4 h-4 border-2 border-[var(--oa-border-default)] border-t-[var(--oa-accent-champagne)] rounded-full animate-spin shrink-0" />
        <span className="text-[13px] text-[var(--oa-text-secondary)]">
          Rendering diagram...
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="my-5 rounded-xl border border-[var(--oa-signal-garnet)]/45 bg-[var(--oa-signal-garnet-tint)] overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 py-2 border-b border-[var(--oa-signal-garnet)]/30">
          <span className="w-2 h-2 rounded-full bg-[var(--oa-signal-garnet)]" aria-hidden="true" />
          <span className="text-[12px] font-mono uppercase tracking-[0.06em] font-medium text-[var(--oa-signal-garnet)]">
            Mermaid Error
          </span>
        </div>
        <div className="p-4 space-y-3">
          {error && (
            <p className="text-[12px] text-[var(--oa-text-secondary)] leading-relaxed">
              {error}
            </p>
          )}
          <details className="group">
            <summary className="text-[11px] font-mono text-[var(--oa-text-muted)] cursor-pointer hover:text-[var(--oa-text-primary)] transition-colors select-none">
              View sanitized source
            </summary>
            <pre className="oa-recessed-well mt-2 text-[12px] font-mono text-[var(--oa-text-secondary)] overflow-x-auto p-3 rounded-lg whitespace-pre-wrap break-all">
              {sanitizedChart}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="oa-recessed-well rounded-xl overflow-hidden my-5">
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[var(--oa-bg-surface)] border-b border-[var(--oa-border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full bg-[var(--oa-signal-sage)] shrink-0"
              aria-hidden="true"
            />
            <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)] truncate">
              {t.mermaid.title}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 no-print">
            <button
              type="button"
              onClick={() => setShowSource((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                showSource
                  ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] border border-[var(--oa-border-default)]"
                  : "text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60"
              }`}
            >
              {showSource ? (
                <>
                  <Eye size={12} strokeWidth={1.6} aria-hidden="true" />
                  <span>{t.mermaid.preview}</span>
                </>
              ) : (
                <>
                  <Code2 size={12} strokeWidth={1.6} aria-hidden="true" />
                  <span>{t.mermaid.source}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopySource}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              {copied ? (
                <>
                  <Check
                    size={12}
                    strokeWidth={1.8}
                    className="text-[var(--oa-signal-sage)]"
                    aria-hidden="true"
                  />
                  <span className="text-[var(--oa-signal-sage)]">
                    {t.mermaid.copied}
                  </span>
                </>
              ) : (
                <>
                  <Copy size={12} strokeWidth={1.6} aria-hidden="true" />
                  <span>{t.mermaid.copy}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              disabled={!svg}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              <Maximize2 size={12} strokeWidth={1.6} aria-hidden="true" />
              <span>{t.mermaid.zoom}</span>
            </button>
          </div>
        </div>

        {showSource ? (
          <pre className="p-4 text-[12px] font-mono text-[var(--oa-text-secondary)] overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
            {sanitizedChart}
          </pre>
        ) : (
          svg && (
            <div
              className="p-4 flex justify-center overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )
        )}
      </div>

      <AnimatePresence>
        {zoomOpen && svg && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.mermaid.title}
            onClick={() => setZoomOpen(false)}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 bg-[var(--oa-scrim)] backdrop-blur-xs no-print"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={MODAL_SLIDE_UP}
              onClick={(e) => e.stopPropagation()}
              className="oa-elev-popover w-full max-w-[960px] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full bg-[var(--oa-signal-sage)]"
                    aria-hidden="true"
                  />
                  <span className="text-[11.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-primary)]">
                    {t.mermaid.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomOpen(false)}
                  aria-label={t.mermaid.closeZoom}
                  className="p-1.5 rounded-lg text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
                >
                  <X size={15} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              <div className="p-5 sm:p-6 overflow-auto bg-[var(--oa-bg-recessed)] flex justify-center items-center">
                <div
                  className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
});
