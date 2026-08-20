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
// Y_UNIT: tinggi satu unit leaf (sumbu Y). 44 → tree penuh 3 level (~21 sub-fitur)
// ≈924px, kanvas seimbang; card compact (~24-28px) → gap sibling ≥ 16px.
export const Y_UNIT = 44;

/** Total descendant count — dipakai badge `+N` pada node collapsed. */
function countDescendants(n: WbsNode): number {
  let c = n.children.length;
  for (const child of n.children) c += countDescendants(child);
  return c;
}

export function layout(
  tree: WbsTree,
  onActivate: (n: WbsNode) => void,
  onToggle: (id: string) => void,
  collapsed: Set<string>,
): { nodes: WbsFlowNode[]; edges: WbsEdge[] } {
  const nodes: WbsFlowNode[] = [];
  const edges: WbsEdge[] = [];

  // Pass 1 (post-order): span per node = jumlah leaf di subtree-nya (min 1).
  const span = new Map<string, number>();
  const computeSpan = (n: WbsNode): number => {
    const s = collapsed.has(n.id) || n.children.length === 0
      ? 1
      : n.children.reduce((acc, c) => acc + computeSpan(c), 0);
    span.set(n.id, s);
    return s;
  };
  computeSpan(tree.root);

  // Pass 2 (pre-order): alokasi unit-Y berurutan — setiap subtree menempati band
  // kontigu, sehingga jalur branch tidak pernah menyilang branch lain.
  // Parent di-center ke TITIK TENGAH y anak pertama & anak terakhir (nilai aktual,
  // bukan tengah band span) — root/parent benar-benar ter-center terhadap visual
  // subtree-nya, bahkan saat span antar anak tidak seimbang.
  const yOf = new Map<string, number>();
  const assignY = (n: WbsNode, startUnit: number): number => {
    const s = span.get(n.id)!;
    const children = collapsed.has(n.id) ? [] : n.children;
    let y: number;
    let cursor = startUnit;
    if (children.length > 0) {
      const childYs: number[] = [];
      for (const c of children) {
        childYs.push(assignY(c, cursor));
        cursor += span.get(c.id)!;
      }
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    } else {
      y = (startUnit + s / 2) * Y_UNIT;
    }
    yOf.set(n.id, y);
    return y;
  };
  assignY(tree.root, 0);

  // Pass 3 (pre-order): push node + edge. X = depth × H_STEP (identik per depth).
  const walk = (n: WbsNode, depth: number) => {
    const isCollapsed = collapsed.has(n.id);
    nodes.push({
      id: n.id,
      type: "wbs",
      position: { x: depth * H_STEP, y: yOf.get(n.id)! },
      data: {
        node: n,
        level: depth,
        onActivate,
        onToggle,
        isCollapsed,
        hiddenCount: isCollapsed ? countDescendants(n) : 0,
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

  walk(tree.root, 0); // root di startUnit 0 — ter-center vertikal ke (modul pertama + terakhir)/2

  return { nodes, edges };
}
