import { useState, useEffect, useRef, useMemo, memo } from "react";
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

  // ── MRD-17: ERD sanitization — AI often outputs SQL keywords invalid in Mermaid ──
  // Only run this pass on erDiagram charts.
  if (/^\s*erDiagram\b/m.test(sanitized)) {
    sanitized = sanitized.split("\n").map(line => {
      // Skip non-attribute lines (entity declarations, relationships, comments)
      if (!/^\s+(int|integer|bigint|smallint|tinyint|float|double|decimal|numeric|real|varchar|char|text|string|boolean|bool|date|datetime|timestamp|time|uuid|json|jsonb|blob|enum|bit|binary|varbinary)\s/i.test(line)) {
        return line;
      }

      // --- Clean up SQL-specific keywords on attribute lines ---

      // Replace multi-word SQL with Mermaid equivalents
      let cleaned = line
        .replace(/\bPRIMARY\s+KEY\b/gi, "PK")
        .replace(/\bFOREIGN\s+KEY\b/gi, "FK")
        .replace(/\bNOT\s+NULL\b/gi, "")
        .replace(/\bAUTO_?INCREMENT\b/gi, "")
        .replace(/\bREFERENCES\s+\w+\s*\([^)]*\)/gi, "")
        .replace(/\bDEFAULT\s+\S+/gi, "")
        .replace(/\bUNIQUE\b(?!\s*\w)/gi, "UK")    // UNIQUE not followed by word → UK
        .replace(/\bVARCHAR\b/gi, "varchar");       // normalize case

      // --- Remove duplicate key constraints (keep first only) ---
      // Mermaid allows max 1 key constraint (PK/FK/UK) per attribute line
      const keyKeywords = ["PK", "FK", "UK"];
      let foundKey = false;
      cleaned = cleaned.split(/\s+/).filter(word => {
        if (keyKeywords.includes(word.toUpperCase())) {
          if (foundKey) return false; // skip duplicate
          foundKey = true;
        }
        return true;
      }).join(" ");

      // --- Normalize whitespace ---
      return cleaned.replace(/\s+/g, " ");
    }).join("\n");
  }

  // ── 1. Edge labels |...| containing () → replace () with [] ──
  sanitized = sanitized.replace(/\|([^|]+)\|/g, (match, content) => {
    if (!content.includes("(") && !content.includes(")")) return match;
    return match.replace(/\(/g, "[").replace(/\)/g, "]");
  });

  // ── 2. Node labels [...] containing parentheses → wrap ["..."] ──
  //     MRD-11: Skip shape-specific nodes: [(Cylinder)], [[Subroutine]],
  //             [/Parallelogram/], [\Trapezoid\], [/Trapezoid\]
  sanitized = sanitized.replace(/\[([^\]]+)\]/g, (match, content) => {
    // Skip shape-specific — content starts with (, [, {, /, or \
    if (/^[\(\[\{\/\\]/.test(content)) return match;
    // Skip already-quoted
    if (content.startsWith('"') && content.endsWith('"')) return match;
    if (content.includes("(") || content.includes(")")) {
      return `["${escapeInnerQuotes(content)}"]`;
    }
    return match;
  });

  // ── 3. Node labels [...] containing commas → wrap ["..."] ──
  sanitized = sanitized.replace(/\[([^\]]+)\]/g, (match, content) => {
    // Skip shape-specific & already-quoted (same as above)
    if (/^[\(\[\{\/\\]/.test(content)) return match;
    if (content.startsWith('"') && content.endsWith('"')) return match;
    if (content.includes(",")) {
      return `["${escapeInnerQuotes(content)}"]`;
    }
    return match;
  });

  // ── 4. Decision nodes {...} containing parentheses → wrap {"..."} ──
  sanitized = sanitized.replace(/\{([^}]+)\}/g, (match, content) => {
    // MRD-11: Skip hexagon {{...}}
    if (/^\{/.test(content)) return match;
    // Skip already-quoted
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
let mermaidModule: any = null;

async function getMermaidModule() {
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
  const throttleRef = useRef<ReturnType<typeof setTimeout>>();

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
            securityLevel: "loose",
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

        const { svg: renderedSvg } = await mermaid.default.render(
          containerId.current,
          normalized
        );
        if (cancelled) return;

        const sanitizedSvg = DOMPurify.sanitize(renderedSvg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ["foreignObject"],
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
