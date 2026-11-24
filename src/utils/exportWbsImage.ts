import type { PRDMode } from "../../shared/types";
import { extractWbs, type WbsPriority } from "./wbs";
import {
  CARD_PROFILE,
  estimateNodeHeight,
  getCardWidth,
  layout,
  wrapCardTitle,
} from "../components/wbsLayout";
import { buildExportMeta, deriveExportSlug, triggerDownload } from "./exportMarkdown";

export type WbsExportFormat = "png" | "svg";
export type WbsExportScale = 2 | 3;
export type WbsExportTheme = "obsidian" | "titanium" | "print" | "transparent";

export interface WbsExportOptions {
  format: WbsExportFormat;
  scale: WbsExportScale;
  theme: WbsExportTheme;
  expandAll: boolean;
  includeHeader: boolean;
  collapsedIds?: ReadonlySet<string>;
  nodeHeights?: Record<string, number>;
  versionLabel?: string;
}

export interface WbsSvgResult {
  svg: string;
  width: number;
  height: number;
  nodeCount: number;
}

export type WbsExportOutcome =
  | {
      ok: true;
      filename: string;
      width: number;
      height: number;
      effectiveScale: number;
      clamped: boolean;
    }
  | { ok: false; reason: "empty" | "render_failed" };

export const MAX_RASTER_EDGE = 16384;
export const MAX_RASTER_PIXELS = 64_000_000;

interface WbsPalette {
  bg: string | null;
  dotColor: string | null;
  headerBg: string;
  headerBorder: string;
  rootBg: string;
  rootBorder: string;
  cardBg: string;
  cardBorder: string;
  subBg: string;
  subBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  champagne: string;
  edgeStroke: string;
  rootEdgeStroke: string;
  badgeBg: string;
  priority: Record<WbsPriority, { short: string; color: string; tint: string }>;
}

const PALETTES: Record<WbsExportTheme, WbsPalette> = {
  obsidian: {
    bg: "#08090C",
    dotColor: "rgba(255,255,255,0.11)",
    headerBg: "#12151B",
    headerBorder: "#242A36",
    rootBg: "#181C24",
    rootBorder: "#B89E74",
    cardBg: "#12151B",
    cardBorder: "#282E3B",
    subBg: "#0D0F13",
    subBorder: "#1E232E",
    textPrimary: "#EAECEF",
    textSecondary: "#A6ADBA",
    textMuted: "#6B7282",
    champagne: "#B89E74",
    edgeStroke: "rgba(255,255,255,0.20)",
    rootEdgeStroke: "#B89E74",
    badgeBg: "#0D0F13",
    priority: {
      "Must-have": { short: "MUST", color: "#C96A6E", tint: "rgba(201,106,110,0.14)" },
      "Should-have": { short: "SHOULD", color: "#7C9BB8", tint: "rgba(124,155,184,0.14)" },
      "Could-have": { short: "COULD", color: "#C29B61", tint: "rgba(194,155,97,0.14)" },
      "Won't-have": { short: "WONT", color: "#8B92A0", tint: "rgba(139,146,160,0.14)" },
    },
  },
  titanium: {
    bg: "#E2E4E9",
    dotColor: "rgba(14,16,21,0.14)",
    headerBg: "#F2F3F5",
    headerBorder: "#C8CDD6",
    rootBg: "#F6F7F9",
    rootBorder: "#7E643E",
    cardBg: "#F2F3F5",
    cardBorder: "#C8CDD6",
    subBg: "#EAEBEF",
    subBorder: "#D0D4DC",
    textPrimary: "#0E1015",
    textSecondary: "#4D5361",
    textMuted: "#6F7685",
    champagne: "#7E643E",
    edgeStroke: "rgba(14,16,21,0.22)",
    rootEdgeStroke: "#7E643E",
    badgeBg: "#E2E4E9",
    priority: {
      "Must-have": { short: "MUST", color: "#9C3A3F", tint: "rgba(156,58,63,0.11)" },
      "Should-have": { short: "SHOULD", color: "#3B5B7A", tint: "rgba(59,91,122,0.11)" },
      "Could-have": { short: "COULD", color: "#8A652E", tint: "rgba(138,101,46,0.11)" },
      "Won't-have": { short: "WONT", color: "#5E6472", tint: "rgba(94,100,114,0.11)" },
    },
  },
  print: {
    bg: "#FFFFFF",
    dotColor: "rgba(14,16,21,0.08)",
    headerBg: "#F8F9FB",
    headerBorder: "#DFE3EA",
    rootBg: "#FAF8F4",
    rootBorder: "#7E643E",
    cardBg: "#FFFFFF",
    cardBorder: "#D0D5DE",
    subBg: "#F8F9FB",
    subBorder: "#E2E6EE",
    textPrimary: "#0E1015",
    textSecondary: "#4D5361",
    textMuted: "#6F7685",
    champagne: "#7E643E",
    edgeStroke: "#B0B7C3",
    rootEdgeStroke: "#7E643E",
    badgeBg: "#F2F4F7",
    priority: {
      "Must-have": { short: "MUST", color: "#9C3A3F", tint: "rgba(156,58,63,0.10)" },
      "Should-have": { short: "SHOULD", color: "#3B5B7A", tint: "rgba(59,91,122,0.10)" },
      "Could-have": { short: "COULD", color: "#8A652E", tint: "rgba(138,101,46,0.10)" },
      "Won't-have": { short: "WONT", color: "#5E6472", tint: "rgba(94,100,114,0.10)" },
    },
  },
  transparent: {
    bg: null,
    dotColor: null,
    headerBg: "#FFFFFF",
    headerBorder: "#D0D5DE",
    rootBg: "#FAF8F4",
    rootBorder: "#7E643E",
    cardBg: "#FFFFFF",
    cardBorder: "#C5CBD6",
    subBg: "#F8F9FB",
    subBorder: "#D8DDE6",
    textPrimary: "#0E1015",
    textSecondary: "#4D5361",
    textMuted: "#6F7685",
    champagne: "#7E643E",
    edgeStroke: "#8B93A3",
    rootEdgeStroke: "#7E643E",
    badgeBg: "#F2F4F7",
    priority: {
      "Must-have": { short: "MUST", color: "#9C3A3F", tint: "rgba(156,58,63,0.10)" },
      "Should-have": { short: "SHOULD", color: "#3B5B7A", tint: "rgba(59,91,122,0.10)" },
      "Could-have": { short: "COULD", color: "#8A652E", tint: "rgba(138,101,46,0.10)" },
      "Won't-have": { short: "WONT", color: "#5E6472", tint: "rgba(94,100,114,0.10)" },
    },
  },
};

const CANVAS_PAD = 40;
const HEADER_HEIGHT = 68;
const HEADER_GAP = 24;
const SANS_FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function computeRasterDimensions(
  width: number,
  height: number,
  scale: WbsExportScale,
): { width: number; height: number; effectiveScale: number; clamped: boolean } {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const maxByEdge = Math.min(MAX_RASTER_EDGE / safeW, MAX_RASTER_EDGE / safeH);
  const maxByArea = Math.sqrt(MAX_RASTER_PIXELS / (safeW * safeH));
  const limitScale = Math.min(maxByEdge, maxByArea);

  if (scale <= limitScale) {
    return {
      width: Math.round(safeW * scale),
      height: Math.round(safeH * scale),
      effectiveScale: scale,
      clamped: false,
    };
  }

  const effectiveScale = Math.max(0.1, Number(limitScale.toFixed(4)));
  return {
    width: Math.max(1, Math.min(MAX_RASTER_EDGE, Math.floor(safeW * effectiveScale))),
    height: Math.max(1, Math.min(MAX_RASTER_EDGE, Math.floor(safeH * effectiveScale))),
    effectiveScale,
    clamped: true,
  };
}

export function buildSmoothStepPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number = 12,
): string {
  const rx1 = Number(x1.toFixed(1));
  const ry1 = Number(y1.toFixed(1));
  const rx2 = Number(x2.toFixed(1));
  const ry2 = Number(y2.toFixed(1));

  if (Math.abs(ry1 - ry2) < 0.5) {
    return `M ${rx1} ${ry1} H ${rx2}`;
  }

  const midX = Number(((rx1 + rx2) / 2).toFixed(1));
  const dy = ry2 - ry1;
  const signY = dy >= 0 ? 1 : -1;
  const r = Math.min(
    radius,
    Math.abs(midX - rx1) / 2,
    Math.abs(rx2 - midX) / 2,
    Math.abs(dy) / 2,
  );
  const rFixed = Number(r.toFixed(1));

  if (rFixed <= 0.5) {
    return `M ${rx1} ${ry1} H ${midX} V ${ry2} H ${rx2}`;
  }

  const preMidX = Number((midX - rFixed).toFixed(1));
  const postMidX = Number((midX + rFixed).toFixed(1));
  const firstCurveY = Number((ry1 + signY * rFixed).toFixed(1));
  const secondCurveY = Number((ry2 - signY * rFixed).toFixed(1));

  return `M ${rx1} ${ry1} H ${preMidX} Q ${midX} ${ry1} ${midX} ${firstCurveY} V ${secondCurveY} Q ${midX} ${ry2} ${postMidX} ${ry2} H ${rx2}`;
}

function resolveCardHeight(
  node: { id: string; title: string; code?: string; priority?: WbsPriority; children: unknown[] },
  depth: number,
  isCollapsed: boolean,
  lines: string[],
  measured?: number,
): number {
  const idx = Math.max(0, Math.min(depth, CARD_PROFILE.length - 1));
  const { padY, font } = CARD_PROFILE[idx];
  const lineH = font * 1.375;
  let computed = padY + lines.length * lineH + 2;
  if (depth === 0) computed += 18;
  if (node.code || (depth === 2 && node.priority)) computed += 20;
  if (!isCollapsed && node.children.length > 0) computed += 20;
  const est = estimateNodeHeight(
    node as Parameters<typeof estimateNodeHeight>[0],
    depth,
  );
  const base = Math.max(measured ?? 0, computed, isCollapsed ? est - 21 : est);
  return Math.ceil(base);
}

export function buildWbsSvg(
  content: string,
  productType: string,
  language: "id" | "en",
  options: WbsExportOptions,
  prdMode?: PRDMode,
): WbsSvgResult | null {
  const tree = extractWbs(content, prdMode);
  if (tree.root.children.length === 0) return null;

  const palette = PALETTES[options.theme];
  const collapsed = options.expandAll
    ? new Set<string>()
    : new Set<string>(options.collapsedIds ?? []);

  // Pre-compute exact SVG card heights so layout() allocates vertical bands without overlap
  // even when a feature card renders a priority badge row without a code or wraps onto extra lines.
  const svgHeights: Record<string, number> = {};
  const measureTree = (n: typeof tree.root, depth: number) => {
    const isCollapsed = collapsed.has(n.id);
    const lines = wrapCardTitle(n.title, depth);
    const measured = options.expandAll ? undefined : options.nodeHeights?.[n.id];
    svgHeights[n.id] = resolveCardHeight(n, depth, isCollapsed, lines, measured);
    if (!isCollapsed) {
      for (const child of n.children) measureTree(child, depth + 1);
    }
  };
  measureTree(tree.root, 0);

  const { nodes, edges } = layout(
    tree,
    () => {},
    () => {},
    collapsed,
    svgHeights,
  );

  // Compute accurate per-node rectangles (matching CARD_PROFILE widths & wrapped lines)
  const rects = new Map<
    string,
    {
      x: number;
      y: number;
      w: number;
      h: number;
      level: number;
      lines: string[];
      node: (typeof nodes)[number]["data"]["node"];
      isCollapsed: boolean;
      hiddenCount: number;
    }
  >();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const flowNode of nodes) {
    const level = flowNode.data.level;
    const isCollapsed = Boolean(flowNode.data.isCollapsed);
    const hiddenCount = flowNode.data.hiddenCount ?? 0;
    const w = getCardWidth(level);
    const lines = wrapCardTitle(flowNode.data.node.title, level);
    const measured = options.expandAll ? undefined : options.nodeHeights?.[flowNode.id];
    const h = resolveCardHeight(flowNode.data.node, level, isCollapsed, lines, measured);

    const x = flowNode.position.x;
    const y = flowNode.position.y;
    rects.set(flowNode.id, {
      x,
      y,
      w,
      h,
      level,
      lines,
      node: flowNode.data.node,
      isCollapsed,
      hiddenCount,
    });

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  const headerOffset = options.includeHeader ? HEADER_HEIGHT + HEADER_GAP : 0;
  const graphW = Math.max(640, Math.ceil(maxX - minX));
  const graphH = Math.max(160, Math.ceil(maxY - minY));
  const totalW = graphW + CANVAS_PAD * 2;
  const totalH = graphH + CANVAS_PAD * 2 + headerOffset;
  const shiftX = CANVAS_PAD - minX;
  const shiftY = CANVAS_PAD + headerOffset - minY;

  const meta = buildExportMeta(content, productType, language);
  const titleText = meta.title.replace(/\s*-\s*(Product Requirements Document|Dokumen Spesifikasi Produk \(PRD\))$/i, "");
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="${escapeXml(titleText)} WBS">`,
  );

  // Optional dot-grid pattern & solid canvas backdrop
  if (palette.bg) {
    if (palette.dotColor) {
      parts.push(
        `<defs><pattern id="wbs-dot-grid" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="${palette.dotColor}" /></pattern></defs>`,
      );
    }
    parts.push(
      `<rect data-wbs-bg="solid" x="0" y="0" width="${totalW}" height="${totalH}" fill="${palette.bg}" />`,
    );
    if (palette.dotColor) {
      parts.push(`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="url(#wbs-dot-grid)" />`);
    }
  }

  // Optional Title & MoSCoW Legend Header Bar
  if (options.includeHeader) {
    const headerW = totalW - CANVAS_PAD * 2;
    const subParts: string[] = [];
    if (options.versionLabel) subParts.push(options.versionLabel);
    subParts.push(`${nodes.length} ${language === "en" ? "nodes" : "node"}`);
    subParts.push(meta.dateLabel);
    const subtitle = subParts.join("  |  ");

    parts.push(`<g data-wbs-header="true">`);
    parts.push(
      `<rect x="${CANVAS_PAD}" y="${CANVAS_PAD}" width="${headerW}" height="${HEADER_HEIGHT}" rx="12" fill="${palette.headerBg}" stroke="${palette.headerBorder}" stroke-width="1" />`,
    );
    parts.push(
      `<text x="${CANVAS_PAD + 20}" y="${CANVAS_PAD + 29}" font-family="${SANS_FONT}" font-size="16" font-weight="700" fill="${palette.textPrimary}">${escapeXml(titleText)} - WBS</text>`,
    );
    parts.push(
      `<text x="${CANVAS_PAD + 20}" y="${CANVAS_PAD + 49}" font-family="${MONO_FONT}" font-size="11" fill="${palette.textMuted}">${escapeXml(subtitle)}</text>`,
    );

    // MoSCoW Legend anchored on right side of header bar
    const legendPriorities: WbsPriority[] = [
      "Must-have",
      "Should-have",
      "Could-have",
      "Won't-have",
    ];
    let lx = CANVAS_PAD + headerW - 20;
    const ly = CANVAS_PAD + HEADER_HEIGHT / 2;
    for (let i = legendPriorities.length - 1; i >= 0; i--) {
      const p = palette.priority[legendPriorities[i]];
      const pillW = p.short.length * 6.5 + 22;
      lx -= pillW;
      parts.push(
        `<rect x="${lx}" y="${ly - 11}" width="${pillW}" height="22" rx="6" fill="${p.tint}" stroke="${p.color}" stroke-opacity="0.35" stroke-width="1" />`,
      );
      parts.push(`<circle cx="${lx + 9}" cy="${ly}" r="3" fill="${p.color}" />`);
      parts.push(
        `<text x="${lx + 16}" y="${ly + 3.5}" font-family="${MONO_FONT}" font-size="9.5" font-weight="600" fill="${p.color}">${p.short}</text>`,
      );
      lx -= 8;
    }
    parts.push(`</g>`);
  }

  // Edges (drawn beneath cards)
  parts.push(`<g data-wbs-edges="true" fill="none">`);
  for (const edge of edges) {
    const src = rects.get(edge.source);
    const tgt = rects.get(edge.target);
    if (!src || !tgt) continue;
    const x1 = src.x + shiftX + src.w;
    const y1 = src.y + shiftY + src.h / 2;
    const x2 = tgt.x + shiftX;
    const y2 = tgt.y + shiftY + tgt.h / 2;
    const d = buildSmoothStepPath(x1, y1, x2, y2, 12);
    const stroke = src.level === 0 ? palette.rootEdgeStroke : palette.edgeStroke;
    const strokeWidth = src.level === 0 ? 1.8 : 1.5;
    parts.push(
      `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`,
    );
  }
  parts.push(`</g>`);

  // Nodes (cards)
  parts.push(`<g data-wbs-nodes="true">`);
  for (const [, r] of rects) {
    const cx = Number((r.x + shiftX).toFixed(1));
    const cy = Number((r.y + shiftY).toFixed(1));
    const isRoot = r.level === 0;
    const isFeature = r.level === 2;
    const isSub = r.level >= 3;
    const profile = CARD_PROFILE[Math.min(r.level, CARD_PROFILE.length - 1)];
    const padX = profile.padX / 2;
    const padTop = profile.padY / 2;
    const fill = isRoot ? palette.rootBg : isSub ? palette.subBg : palette.cardBg;
    const stroke = isRoot ? palette.rootBorder : isSub ? palette.subBorder : palette.cardBorder;
    const strokeWidth = isRoot ? 1.5 : 1;

    parts.push(
      `<rect x="${cx}" y="${cy}" width="${r.w}" height="${r.h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
    );

    let cursorY = cy + padTop;

    if (isRoot) {
      cursorY += 10;
      parts.push(
        `<text x="${cx + padX}" y="${cursorY}" font-family="${MONO_FONT}" font-size="9.5" font-weight="600" letter-spacing="0.6" fill="${palette.champagne}">ROOT</text>`,
      );
      cursorY += 8;
    }

    const pInfo = r.node.priority ? palette.priority[r.node.priority] : undefined;
    if (r.node.code || (isFeature && pInfo)) {
      cursorY += 10;
      if (r.node.code) {
        parts.push(
          `<text x="${cx + padX}" y="${cursorY}" font-family="${MONO_FONT}" font-size="9.5" font-weight="600" fill="${palette.champagne}">${escapeXml(r.node.code)}</text>`,
        );
      }
      if (isFeature && pInfo) {
        const bw = pInfo.short.length * 6 + 18;
        const bx = cx + r.w - padX - bw;
        const by = cursorY - 10;
        parts.push(
          `<rect x="${bx}" y="${by}" width="${bw}" height="15" rx="4" fill="${pInfo.tint}" stroke="${pInfo.color}" stroke-opacity="0.35" stroke-width="0.8" />`,
        );
        parts.push(`<circle cx="${bx + 7}" cy="${by + 7.5}" r="2.3" fill="${pInfo.color}" />`);
        parts.push(
          `<text x="${bx + 12.5}" y="${by + 10.5}" font-family="${MONO_FONT}" font-size="8.5" font-weight="600" fill="${pInfo.color}">${pInfo.short}</text>`,
        );
      }
      cursorY += 9;
    }

    // Wrapped title text
    const lineHeight = Number((profile.font * 1.375).toFixed(1));
    const titleStartY = cursorY + profile.font * 0.92;
    const fontWeight = isRoot ? 700 : 600;
    parts.push(
      `<text x="${cx + padX}" y="${titleStartY.toFixed(1)}" font-family="${SANS_FONT}" font-size="${profile.font}" font-weight="${fontWeight}" fill="${palette.textPrimary}">`,
    );
    r.lines.forEach((line, idx) => {
      const dy = idx === 0 ? 0 : lineHeight;
      parts.push(`<tspan x="${cx + padX}" dy="${dy}">${escapeXml(line)}</tspan>`);
    });
    parts.push(`</text>`);
    cursorY = titleStartY + (r.lines.length - 1) * lineHeight;

    // Collapsed +N badge
    if (r.isCollapsed && r.hiddenCount > 0) {
      const label = `+${r.hiddenCount}`;
      const pillW = label.length * 6 + 12;
      const px = cx + r.w - padX - pillW;
      const py = cy + padTop;
      parts.push(
        `<rect x="${px}" y="${py}" width="${pillW}" height="16" rx="8" fill="${palette.badgeBg}" stroke="${palette.cardBorder}" stroke-width="0.8" />`,
      );
      parts.push(
        `<text x="${px + pillW / 2}" y="${py + 11.2}" text-anchor="middle" font-family="${MONO_FONT}" font-size="9" font-weight="600" fill="${palette.champagne}">${label}</text>`,
      );
    }

    // Expanded child count footer
    if (!r.isCollapsed && r.node.children.length > 0) {
      const count = r.node.children.length;
      const unit = language === "en" ? (count === 1 ? "item" : "items") : "item";
      parts.push(
        `<text x="${cx + padX}" y="${(cursorY + 16).toFixed(1)}" font-family="${MONO_FONT}" font-size="9.5" fill="${palette.textMuted}">${count} ${unit}</text>`,
      );
    }
  }
  parts.push(`</g>`);
  parts.push(`</svg>`);

  return {
    svg: parts.join(""),
    width: totalW,
    height: totalH,
    nodeCount: nodes.length,
  };
}

function rasterizeSvgToPngBlob(
  svg: string,
  targetWidth: number,
  targetHeight: number,
): Promise<Blob | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        canvas.toBlob((blob) => resolve(blob), "image/png");
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export async function exportWbsImage(
  content: string,
  productType: string,
  language: "id" | "en",
  options: WbsExportOptions,
  prdMode?: PRDMode,
): Promise<WbsExportOutcome> {
  const rendered = buildWbsSvg(content, productType, language, options, prdMode);
  if (!rendered) {
    return { ok: false, reason: "empty" };
  }

  const slug = deriveExportSlug(content, productType);

  if (options.format === "svg") {
    const filename = `${slug}-wbs.svg`;
    const blob = new Blob([rendered.svg], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(blob, filename);
    return {
      ok: true,
      filename,
      width: rendered.width,
      height: rendered.height,
      effectiveScale: 1,
      clamped: false,
    };
  }

  const dims = computeRasterDimensions(rendered.width, rendered.height, options.scale);
  const pngBlob = await rasterizeSvgToPngBlob(rendered.svg, dims.width, dims.height);
  if (!pngBlob) {
    return { ok: false, reason: "render_failed" };
  }

  const filename = `${slug}-wbs-${options.scale}x.png`;
  triggerDownload(pngBlob, filename);
  return {
    ok: true,
    filename,
    width: dims.width,
    height: dims.height,
    effectiveScale: dims.effectiveScale,
    clamped: dims.clamped,
  };
}
