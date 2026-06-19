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
export function sanitizeMermaid(chart: string): string {
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
    if (/^[([{/\\]/.test(content)) return match;
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
    if (/^[([{/\\]/.test(content)) return match;
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
