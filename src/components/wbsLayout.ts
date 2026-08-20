import type { Node, Edge } from "@xyflow/react";
import type { WbsNode, WbsTree } from "../utils/wbs";

export type WbsFlowNode = Node<
  {
    node: WbsNode;
    /** 0=root, 1=module, 2=feature, 3=sub-feature. */
    level: number;
    onActivate?: (node: WbsNode) => void;
    isCollapsed?: boolean;
    hiddenCount?: number;
    onToggle?: (id: string) => void;
    /** Dilaporkan card via DOM (tinggi aktual) — dipakai layout utk alokasi Y akurat. */
    onMeasure?: (id: string, height: number) => void;
  },
  "wbs"
>;

// pathOptions milik tipe turunan SmoothStepEdge — perluasan lokal untuk edge smoothstep.
export type WbsEdge = Edge & {
  pathOptions?: { offset?: number; borderRadius?: number; stepPosition?: number };
};

/* ---------- Layout: RT-lite horizontal — kedalaman di sumbu X, leaf di sumbu Y ---------- */
// H_STEP: jarak antar level (sumbu X). Kolom per depth identik: x = depth × H_STEP.
// 280 → kolom sedikit renggang, rasio lebar:tinggi mendekati referensi WBS_Design.png.
export const H_STEP = 280;
// Y_UNIT: pitch lama (pitch tetap 44px per unit leaf). Dipertahankan sebagai ekspor
// kompatibilitas — alokasi Y kini berbasis bounding box aktual, Y_UNIT hanya dipakai
// sebagai lantai minimal jarak antar sibling agar tree compact.
export const Y_UNIT = 44;
// GAP: jarak minimum antar bounding box node dalam satu depth (sumbu Y), px.
export const GAP = 20;

/* ---------- Estimasi tinggi card (fallback layout pass pertama / tes) ---------- */
// Nilai turun dari style WbsNodeCard di WbsCanvas.tsx (CARD_SIZES / TITLE_SIZES).
// Per-depth: [padding vertikal (py), padding horizontal total (px), lebar card (w), font title (text)].
const CARD_PROFILE = [
  { padY: 20, padX: 32, width: 230, font: 15 }, // depth 0: min-w-[230px] px-4 py-2.5 text-[15px]
  { padY: 12, padX: 24, width: 200, font: 12.5 }, // depth 1: w-[200px] px-3 py-1.5 text-[12.5px]
  { padY: 12, padX: 24, width: 190, font: 12 }, // depth 2: w-[190px] px-3 py-1.5 text-[12px]
  { padY: 8, padX: 20, width: 155, font: 11 }, // depth 3: w-[155px] px-2.5 py-1 text-[11px]
] as const;

// leading-snug = 1.375 (Tailwind). Estimasi lebar karakter rata-rata = 0.55em (semibold/bold).
const LINE_HEIGHT = 1.375;
const CHAR_W_FACTOR = 0.55;
const MIN_CARD_H = 24; // min-h-[24px] pada semua card
const BORDER_H = 2; // border 1px atas + bawah pada card
const ROOT_LABEL_ROW = 19; // label "Root" text-[10px] (15px line) + mb-1 (4px)
const CODE_ROW = 19; // baris code text-[10px] font-mono (15px) + mb-1 (4px)
const CHILD_COUNT_ROW = 21; // mt-1.5 (6px) + text-[10px] font-mono (15px line)

/** Total descendant count — dipakai badge `+N` pada node collapsed. */
function countDescendants(n: WbsNode): number {
  let c = n.children.length;
  for (const child of n.children) c += countDescendants(child);
  return c;
}

/**
 * Estimasi tinggi card (px) saat dirender penuh (expanded): wrap title sesuai lebar
 * kolom per depth, baris code & child-count bila ada, padding, border, min-height.
 * ponytail: CHAR_W_FACTOR=0.55 adalah heuristik lebar karakter rata-rata — cukup akurat
 * utk pass pertama; kanvas lalu memakai tinggi DOM aktual via nodeHeights.
 */
export function estimateNodeHeight(node: WbsNode, depth: number): number {
  const { padY, padX, width, font } = CARD_PROFILE[Math.min(depth, CARD_PROFILE.length - 1)];
  const contentWidth = width - padX;
  const charsPerLine = Math.max(1, Math.floor(contentWidth / (font * CHAR_W_FACTOR)));
  const lines = Math.max(1, Math.ceil(node.title.length / charsPerLine));
  let h = padY + lines * font * LINE_HEIGHT + BORDER_H;
  if (depth === 0) h += ROOT_LABEL_ROW;
  if (node.code) h += CODE_ROW;
  if (node.children.length > 0) h += CHILD_COUNT_ROW;
  return Math.max(MIN_CARD_H, h);
}

/** Tinggi card versi ter-render: DOM aktual bila diberikan, else estimator. */
function nodeHeight(
  n: WbsNode,
  depth: number,
  collapsed: boolean,
  nodeHeights?: Record<string, number>,
): number {
  const actual = nodeHeights?.[n.id];
  if (actual != null) return actual;
  const est = estimateNodeHeight(n, depth);
  // Card collapsed tidak merender baris child-count — kurangi agar pitch tidak menggembung.
  return collapsed && n.children.length > 0 ? est - CHILD_COUNT_ROW : est;
}

export function layout(
  tree: WbsTree,
  onActivate: (n: WbsNode) => void,
  onToggle: (id: string) => void,
  collapsed: Set<string>,
  nodeHeights?: Record<string, number>,
  onMeasure?: (id: string, height: number) => void,
): { nodes: WbsFlowNode[]; edges: WbsEdge[] } {
  const nodes: WbsFlowNode[] = [];
  const edges: WbsEdge[] = [];

  // Pass 1 (post-order): alokasi Y berbasis bounding box. Setiap subtree menempati band
  // kontigu [bandTop, bandBottom]; sibling berikutnya mulai di bandBottom+GAP → bbox tidak
  // pernah tumpang tindih (sedepth), jalur branch tidak menyilang. Parent di-center ke
  // midpoint bbox CARD anak (top card pertama … bottom card terakhir), diklem ke bandTop
  // agar parent tidak menonjol di atas band miliknya.
  const topOf = new Map<string, number>();
  const assignY = (
    n: WbsNode,
    depth: number,
    bandTop: number,
  ): { bandBottom: number; cardTop: number; cardBottom: number } => {
    const isCollapsed = collapsed.has(n.id);
    const h = nodeHeight(n, depth, isCollapsed, nodeHeights);
    const children = isCollapsed ? [] : n.children;
    if (children.length === 0) {
      topOf.set(n.id, bandTop);
      return { bandBottom: bandTop + h, cardTop: bandTop, cardBottom: bandTop + h };
    }
    let cursor = bandTop;
    let bandBottom = bandTop;
    const childBoxes: { bandBottom: number; cardTop: number; cardBottom: number }[] = [];
    for (const c of children) {
      const b = assignY(c, depth + 1, cursor);
      childBoxes.push(b);
      bandBottom = b.bandBottom;
      cursor = b.bandBottom + GAP;
    }
    const center = (childBoxes[0].cardTop + childBoxes[childBoxes.length - 1].cardBottom) / 2;
    const top = Math.max(bandTop, center - h / 2);
    topOf.set(n.id, top);
    return { bandBottom: Math.max(bandBottom, top + h), cardTop: top, cardBottom: top + h };
  };
  assignY(tree.root, 0, 0);

  // Pass 2 (pre-order): push node + edge. X = depth × H_STEP (identik per depth).
  const walk = (n: WbsNode, depth: number) => {
    const isCollapsed = collapsed.has(n.id);
    nodes.push({
      id: n.id,
      type: "wbs",
      position: { x: depth * H_STEP, y: topOf.get(n.id)! },
      data: {
        node: n,
        level: depth,
        onActivate,
        onToggle,
        isCollapsed,
        hiddenCount: isCollapsed ? countDescendants(n) : 0,
        onMeasure,
      },
    });
    if (isCollapsed) return; // DFS stop — buang semua descendant
    for (const c of n.children) {
      edges.push({
        id: `${n.id}→${c.id}`,
        source: n.id,
        target: c.id,
        type: "smoothstep",
        pathOptions: { borderRadius: 12 },
        style: { stroke: "#3f3f46", strokeWidth: 1.5 },
      });
      walk(c, depth + 1);
    }
  };

  walk(tree.root, 0);

  return { nodes, edges };
}
