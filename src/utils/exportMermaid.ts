// Mermaid diagram rasterizer for PDF and DOCX export.
// Renders all unique charts inside a single light-theme pass and restores
// the active Obsidian Atelier live theme afterward.
import DOMPurify from "dompurify";
import { sanitizeMermaid } from "./mermaid";
import { fenceLang } from "./exportMarkdown";

export interface PngResult {
  dataUrl: string;
  width: number;
  height: number;
}

// Live Mermaid configs mirrored from MermaidRenderer.tsx so restoring after export
// keeps the interactive canvas visually unchanged.
const DARK_THEME_CONFIG = {
  startOnLoad: false,
  theme: "dark" as const,
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  securityLevel: "strict" as const,
  htmlLabels: false,
  themeVariables: {
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
  },
};

const LIVE_LIGHT_THEME_CONFIG = {
  startOnLoad: false,
  theme: "neutral" as const,
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  securityLevel: "strict" as const,
  htmlLabels: false,
  themeVariables: {
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
  },
};

// Clean print-white editorial Mermaid palette (htmlLabels: false ensures SVG <text>
// instead of <foreignObject>, which canvas rasterization would otherwise drop).
const PRINT_LIGHT_THEME_CONFIG = {
  startOnLoad: false,
  theme: "base" as const,
  fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
  securityLevel: "strict" as const,
  htmlLabels: false,
  flowchart: { htmlLabels: false },
  themeVariables: {
    background: "#FFFFFF",
    primaryColor: "#F4F6F9",
    primaryTextColor: "#181C24",
    primaryBorderColor: "#8A7047",
    lineColor: "#475569",
    secondaryColor: "#FAF8F4",
    tertiaryColor: "#EEF2F6",
    mainBkg: "#F4F6F9",
    nodeBorder: "#8A7047",
    clusterBkg: "#F8FAFC",
    clusterBorder: "#CBD5E1",
    titleColor: "#111827",
    edgeLabelBackground: "#FFFFFF",
  },
};

export function extractMermaidCharts(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const charts: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```") && fenceLang(trimmed) === "mermaid") {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      const code = codeLines.join("\n");
      if (!seen.has(code)) {
        seen.add(code);
        charts.push(code);
      }
    }
  }
  return charts;
}

function extractSvgDimensions(svgEl: SVGSVGElement): { width: number; height: number } {
  const wAttr = svgEl.getAttribute("width") || "";
  const hAttr = svgEl.getAttribute("height") || "";

  let width = /^\d+(\.\d+)?$/.test(wAttr.trim()) ? parseFloat(wAttr) : NaN;
  let height = /^\d+(\.\d+)?$/.test(hAttr.trim()) ? parseFloat(hAttr) : NaN;

  if (!width || !height) {
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(parseFloat);
      const vbW = parts[2];
      const vbH = parts[3];
      if (!width && Number.isFinite(vbW) && vbW > 0) width = vbW;
      if (!height && Number.isFinite(vbH) && vbH > 0) height = vbH;
    }
  }

  if (!width) {
    const style = svgEl.getAttribute("style") || "";
    const m = style.match(/max-width:\s*([\d.]+)\s*px/i);
    if (m) width = parseFloat(m[1]);
  }

  if (!width || width <= 0) width = 800;
  if (!height || height <= 0) height = 600;
  return { width, height };
}

async function svgToPng(svg: string): Promise<PngResult> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgEl = svgDoc.querySelector("svg");
    if (!svgEl) {
      reject(new Error("Invalid SVG: no <svg> element"));
      return;
    }

    const { width, height } = extractSvgDimensions(svgEl);

    svgEl.setAttribute("width", String(width));
    svgEl.setAttribute("height", String(height));
    if (!svgEl.getAttribute("preserveAspectRatio")) {
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    svgEl.style.removeProperty("max-width");
    svgEl.style.maxWidth = `${width}px`;

    const serializer = new XMLSerializer();
    const fixedSvg = serializer.serializeToString(svgEl);

    const blob = new Blob([fixedSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // High-DPI rasterization capped to prevent memory spikes on giant diagrams
      const scale = Math.min(2, 2400 / Math.max(width, height, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        width,
        height,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG into Image"));
    };
    img.src = url;
  });
}

async function renderMermaidToPng(chart: string): Promise<PngResult | null> {
  if (typeof document === "undefined") return null;
  const mermaidMod = await import("mermaid");
  const mermaid = mermaidMod.default;
  const id = `export-mermaid-${Math.random().toString(36).slice(2, 11)}`;

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-99999px;top:0;width:auto;height:auto;overflow:hidden;pointer-events:none;z-index:-1;opacity:0;";
  document.body.appendChild(host);
  try {
    const normalized = sanitizeMermaid(chart)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "\n");
    await mermaid.parse(normalized);
    const { svg } = await mermaid.render(id, normalized, host);
    const sanitized = DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "iframe", "object", "embed"],
    });
    return await svgToPng(sanitized);
  } catch (err) {
    console.warn("Mermaid render for export failed:", err);
    return null;
  } finally {
    host.remove();
  }
}

/**
 * Pre-render all unique Mermaid blocks in one light-theme pass and restore
 * the live UI Mermaid theme immediately in `finally`.
 */
export async function renderAllMermaidCharts(
  content: string,
): Promise<Map<string, PngResult | null>> {
  const charts = extractMermaidCharts(content);
  const chartImageMap = new Map<string, PngResult | null>();
  if (charts.length === 0 || typeof document === "undefined") {
    return chartImageMap;
  }

  const mermaidMod = await import("mermaid");
  const mermaid = mermaidMod.default;
  mermaid.initialize(PRINT_LIGHT_THEME_CONFIG);
  try {
    const results = await Promise.all(charts.map((c) => renderMermaidToPng(c)));
    charts.forEach((c, idx) => {
      chartImageMap.set(c, results[idx]);
    });
  } finally {
    const isLight =
      typeof document !== "undefined" &&
      document.documentElement?.dataset?.theme === "light";
    mermaid.initialize(isLight ? LIVE_LIGHT_THEME_CONFIG : DARK_THEME_CONFIG);
  }
  return chartImageMap;
}
