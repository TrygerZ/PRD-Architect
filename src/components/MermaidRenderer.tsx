import { useState, useEffect, useRef, useMemo } from "react";

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
  let sanitized = chart;

  // 1. Edge labels |...| containing () → replace () with []
  //    Example: A -->|text (parens)| B → A -->|text [parens]| B
  sanitized = sanitized.replace(/\|[^|]+\|/g, (match) =>
    match.replace(/\(/g, "[").replace(/\)/g, "]")
  );

  // 2. Node labels [...] containing parentheses → wrap in double quotes
  //    Example: B[Start (here)] → B["Start (here)"]
  sanitized = sanitized.replace(/\[([^\]]+)\]/g, (match, content) => {
    if (content.startsWith('"')) return match; // already quoted
    if (content.includes("(") || content.includes(")")) {
      return `["${content}"]`;
    }
    return match;
  });

  // 3. Node labels [...] containing commas → wrap in double quotes
  //    Example: C[Option A, Option B] → C["Option A, Option B"]
  sanitized = sanitized.replace(/\[([^\]]+)\]/g, (match, content) => {
    if (content.startsWith('"')) return match; // already quoted
    if (content.includes(",")) {
      return `["${content}"]`;
    }
    return match;
  });

  // 4. Decision nodes {...} containing parentheses → wrap in double quotes
  //    Example: D{Decision (yes/no)} → D{"Decision (yes/no)"}
  sanitized = sanitized.replace(/\{([^}]+)\}/g, (match, content) => {
    if (content.startsWith('"')) return match; // already quoted
    if (content.includes("(") || content.includes(")")) {
      return `{"${content}"}`;
    }
    return match;
  });

  return sanitized;
}

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

        mermaid.default.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#1e1e2e",
            primaryTextColor: "#cdd6f4",
            fontFamily: "Geist Mono",
          },
        });

        const { svg: renderedSvg } = await mermaid.default.render(
          containerId.current,
          sanitizedChart
        );
        if (cancelled) return;

        setSvg(renderedSvg);
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
