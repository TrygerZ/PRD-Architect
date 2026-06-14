import { useState, useEffect, useRef, useMemo } from "react";
import DOMPurify from "dompurify";

/**
 * Auto-fix AI-generated Mermaid syntax yang sering error.
 *
 * AI (seperti Gemini/DeepSeek) sering menghasilkan diagram Mermaid dengan
 * syntax yang tidak valid — terutama parentheses `()` dan commas `,` di dalam
 * label yang tidak di-quote. Mermaid parser sangat ketat: parentheses HARUS
 * di-escape atau label HARUS di-wrap dengan double quotes.
 *
 * Transformasi yang dilakukan:
 * 1. Edge labels `|...|` mengandung `()` → ganti `()` jadi `[]`
 * 2. Node labels `[...]` mengandung parentheses → wrap `["..."]`
 * 3. Node labels `[...]` mengandung commas → wrap `["..."]`
 * 4. Decision nodes `{...}` mengandung parentheses → wrap `{"..."}`
 */
function sanitizeMermaid(chart: string): string {
  // MRD-04: Defensive check for non-string input
  if (typeof chart !== "string") {
    console.warn("sanitizeMermaid: expected string, got", typeof chart);
    return "";
  }

  let sanitized = chart;

  // MRD-03: Extract comments to protect them from sanitization
  const comments: string[] = [];
  sanitized = sanitized.replace(/%%.*$/gm, (match) => {
    comments.push(match);
    return `__COMMENT_${comments.length - 1}__`;
  });

  // MRD-01: Helper to escape inner double quotes before wrapping
  function escapeInnerQuotes(content: string): string {
    return content.replace(/"/g, '\\"');
  }

  // 1. Edge labels |...| containing () → replace () with []
  //    MRD-06: Skip if no parens present
  sanitized = sanitized.replace(/\|([^|]+)\|/g, (match, content) => {
    if (!content.includes("(") && !content.includes(")")) return match;
    return match.replace(/\(/g, "[").replace(/\)/g, "]");
  });

  // 2. Node labels [...] containing parentheses → wrap in double quotes
  //    MRD-05: Check BOTH start AND end quotes; MRD-01: escape inner quotes
  sanitized = sanitized.replace(/\[([^\]]+)\]/g, (match, content) => {
    if (content.startsWith('"') && content.endsWith('"')) return match;
    if (content.includes("(") || content.includes(")")) {
      return `["${escapeInnerQuotes(content)}"]`;
    }
    return match;
  });

  // 3. Node labels [...] containing commas → wrap in double quotes
  //    MRD-05: Check BOTH start AND end quotes; MRD-01: escape inner quotes
  sanitized = sanitized.replace(/\[([^\]]+)\]/g, (match, content) => {
    if (content.startsWith('"') && content.endsWith('"')) return match;
    if (content.includes(",")) {
      return `["${escapeInnerQuotes(content)}"]`;
    }
    return match;
  });

  // 4. Decision nodes {...} containing parentheses → wrap in double quotes
  //    MRD-05: Check BOTH start AND end quotes; MRD-01: escape inner quotes
  sanitized = sanitized.replace(/\{([^}]+)\}/g, (match, content) => {
    if (content.startsWith('"') && content.endsWith('"')) return match;
    if (content.includes("(") || content.includes(")")) {
      return `{"${escapeInnerQuotes(content)}"}`;
    }
    return match;
  });

  // MRD-03: Restore comments after sanitization
  sanitized = sanitized.replace(/__COMMENT_(\d+)__/g, (_, index) =>
    comments[parseInt(index)]
  );

  return sanitized;
}

// MRD-08: Module-level flag to avoid re-initializing mermaid on every render
let mermaidInitialized = false;

interface MermaidRendererProps {
  chart: string;
}

export function MermaidRenderer({ chart }: MermaidRendererProps) {
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sanitizedChart = useMemo(() => sanitizeMermaid(chart), [chart]);
  const containerId = useRef(
    `mermaid-${Math.random().toString(36).substring(2, 11)}`
  );

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      setStatus("loading");
      setSvg(null);
      setError(null);

      try {
        const mermaid = await import("mermaid");
        if (cancelled) return;

        // MRD-08: Only initialize mermaid once
        if (!mermaidInitialized) {
          mermaid.default.initialize({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
              primaryColor: "#1e1e2e",
              primaryTextColor: "#cdd6f4",
              fontFamily: "Geist Mono",
            },
          });
          mermaidInitialized = true;
        }

        const { svg: renderedSvg } = await mermaid.default.render(
          containerId.current,
          sanitizedChart
        );
        if (cancelled) return;

        const sanitizedSvg = DOMPurify.sanitize(renderedSvg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ["foreignObject"],
        });
        setSvg(sanitizedSvg);
        setStatus("success");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to render diagram"
        );
        setStatus("error");
      }
    }

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [sanitizedChart]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 p-4 my-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="w-4 h-4 border-2 border-[var(--color-text-muted)] border-t-[var(--color-interactive)] rounded-full animate-spin" />
        <span className="text-[13px] text-[var(--color-text-secondary)]">
          Rendering diagram...
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="my-6 rounded-md border border-[var(--color-error)] bg-[var(--color-error-bg)] overflow-hidden">
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
    <div className="my-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
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
}
