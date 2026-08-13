import { useState, useEffect, useRef, useMemo, memo } from "react";
import DOMPurify from "dompurify";
import { sanitizeMermaid } from "../utils/mermaid";

// MRD-08: Module-level flag to avoid re-initializing mermaid on every render
let mermaidInitialized = false;
type MermaidModule = typeof import("mermaid");
let mermaidModule: MermaidModule | null = null;

async function getMermaidModule(): Promise<MermaidModule> {
  if (!mermaidModule) {
    mermaidModule = await import("mermaid");
  }
  return mermaidModule;
}

interface MermaidRendererProps {
  chart: string;
  isGenerating?: boolean;
}

export const MermaidRenderer = memo(function MermaidRenderer({ chart, isGenerating = false }: MermaidRendererProps) {
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sanitizedChart = useMemo(() => sanitizeMermaid(chart), [chart]);
  const containerId = useRef(
    `mermaid-${Math.random().toString(36).substring(2, 11)}`
  );
  const svgRef = useRef<string | null>(null);
  const lastRenderTimeRef = useRef(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

        // MRD-08: Only initialize mermaid once
        if (!mermaidInitialized) {
          mermaid.default.initialize({
            startOnLoad: false,
            theme: "dark",
            fontFamily: "Geist Mono",
            securityLevel: "strict",
            htmlLabels: false,
            themeVariables: {
              primaryColor: "#1e1e2e",
              primaryTextColor: "#cdd6f4",
            },
          });
          mermaidInitialized = true;
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
          const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          throw new Error(`Parse error: ${msg}`);
        }

        // Container off-screen position:fixed mencegah mermaid.render()
        // menyisipkan <div> in-flow ke document.body (yang mengubah
        // scrollHeight → viewport bergeser → layar bergetar) dan mencegah
        // elemen sementara tertinggal di body setelah render.
        const host = document.createElement("div");
        host.style.cssText =
          "position:fixed;left:-99999px;top:0;width:auto;height:auto;overflow:hidden;pointer-events:none;z-index:-1;opacity:0;";
        document.body.appendChild(host);
        let renderedSvg: string;
        try {
          ({ svg: renderedSvg } = await mermaid.default.render(
            containerId.current,
            normalized,
            host
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
        setSvg(sanitizedSvg);
        setStatus("success");
      } catch (err) {
        if (cancelled) return;
        // MRD-14: Only show error if no previous successful render
        if (!svgRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram"
          );
          setStatus("error");
        }
      }
    }

    // MRD-16: Throttle during streaming — max 1 render every 2s.
    // This prevents the 800ms-debounce problem (timer never fires during
    // active streaming), while still batching rapid content changes.
    // After generation: render immediately (no throttle).
    clearTimeout(throttleRef.current);
    const now = Date.now();
    const sinceLast = now - lastRenderTimeRef.current;

    if (isGenerating && sinceLast < 2000) {
      // Throttle: wait until 2s since last render
      throttleRef.current = setTimeout(() => {
        if (!cancelled) renderDiagram();
      }, 2000 - sinceLast);
    } else {
      // Immediate with 100ms micro-delay for React batching during streaming
      throttleRef.current = setTimeout(() => {
        if (!cancelled) renderDiagram();
      }, isGenerating ? 100 : 0);
    }

    return () => {
      cancelled = true;
      clearTimeout(throttleRef.current);
    };
  }, [sanitizedChart, isGenerating]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 p-4 my-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] min-h-[80px] transition-all duration-300">
        <div className="w-4 h-4 border-2 border-[var(--color-text-muted)] border-t-[var(--color-interactive)] rounded-full animate-spin" />
        <span className="text-[13px] text-[var(--color-text-secondary)]">
          Rendering diagram...
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="my-6 rounded-md border border-[var(--color-error)] bg-[var(--color-error-bg)] overflow-hidden transition-all duration-300">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-error)] bg-[var(--color-error-bg)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-error)]" />
          <span className="text-[13px] font-medium text-[var(--color-error)]">
            Mermaid Error
          </span>
        </div>
        <div className="p-4 space-y-3">
          {error && (
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              {error}
            </p>
          )}
          <details className="group">
            <summary className="text-[11px] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors select-none">
              View sanitized source
            </summary>
            <pre className="mt-2 text-[12px] font-mono text-[var(--color-text-secondary)] overflow-x-auto p-3 bg-[var(--color-bg)] rounded-sm border border-[var(--color-border)] whitespace-pre-wrap break-all">
              {sanitizedChart}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  // success — render SVG
  return (
    <div className="my-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all duration-300">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
        <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
          diagram
        </span>
      </div>
      <div
        className="p-4 flex justify-center overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
    </div>
  );
});
