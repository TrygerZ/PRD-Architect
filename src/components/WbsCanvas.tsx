import { useMemo, useState, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Info, ChevronDown, ChevronRight, Network } from "lucide-react";
import { extractWbs, flattenWbs, type WbsNode } from "../utils/wbs";
import { DetailPanel } from "./DetailPanel";
import { layout, type WbsFlowNode } from "./wbsLayout";

type PrdMode = "business" | "technical" | "simple";

interface WbsCanvasProps {
  content: string;
  prdMode?: PrdMode;
  language: "id" | "en";
  onSelect?: (node: WbsNode) => void;
}

/* ---------- Per-level color mapping ---------- */
const PRIORITY_COLORS: Record<string, { stroke: string; bg: string; text: string }> = {
  "Must-have": { stroke: "#10b981", bg: "rgba(16, 185, 129, 0.16)", text: "#34d399" },
  "Should-have": { stroke: "#38bdf8", bg: "rgba(56, 189, 248, 0.16)", text: "#7dd3fc" },
  "Could-have": { stroke: "#f59e0b", bg: "rgba(245, 158, 11, 0.16)", text: "#fbbf24" },
  "Won't-have": { stroke: "#64748b", bg: "rgba(100, 116, 139, 0.16)", text: "#94a3b8" },
};
const ROOT_COLOR = { stroke: "#f59e0b", bg: "rgba(245, 158, 11, 0.16)", text: "#fbbf24" };
// Module (level 1) memakai NEUTRAL_COLOR slate — netral, bukan warna modul terpisah.
const NEUTRAL_COLOR = { stroke: "#64748b", bg: "rgba(100, 116, 139, 0.12)", text: "#94a3b8" };
const SUB_COLOR = { stroke: "#334155", bg: "rgba(148, 163, 184, 0.08)", text: "#94a3b8" };

/* ---------- Layout: dipindah ke ./wbsLayout (murni, tanpa React) ---------- */

/* ---------- Node card ---------- */
const CARD_SIZES: Record<number, string> = {
  0: "min-w-[230px] px-4 py-2.5 min-h-[24px]",
  1: "w-[200px] px-3 py-1.5 min-h-[24px]",
  2: "w-[190px] px-3 py-1.5 min-h-[24px]",
  3: "w-[155px] px-2.5 py-1 min-h-[24px]",
};
const TITLE_SIZES: Record<number, string> = {
  0: "text-[15px] font-bold",
  1: "text-[12.5px] font-semibold",
  2: "text-[12px] font-semibold",
  3: "text-[11px] font-semibold",
};

function WbsNodeCard({ data, selected }: NodeProps<WbsFlowNode>) {
  const { node, level = 0, onActivate, onToggle, isCollapsed = false, hiddenCount = 0 } = data;
  const isRoot = level === 0;
  const color = isRoot
    ? ROOT_COLOR
    : level === 1
      ? NEUTRAL_COLOR
      : level === 2
        ? (node.priority && PRIORITY_COLORS[node.priority]) || NEUTRAL_COLOR
        : SUB_COLOR;

  // A1: keyboard activation — RF v12 hanya memanggil onNodeClick dari mouse/selection.
  const handleKeyDown = (e: import("react").KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // jangan ganggu shortcut RF
    e.preventDefault(); // spasi: cegah scroll halaman
    onActivate?.(node);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${node.code ? `${node.code}: ` : ""}${node.title}`}
      className={`group rounded-xl border transition-shadow cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] ${
        selected ? "shadow-floating" : "shadow-card hover:shadow-floating"
      } ${CARD_SIZES[level]}`}
      style={{
        background: color.bg,
        borderColor: selected || isRoot ? color.stroke : "var(--color-border)",
      }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" isConnectable={false} />
      {isRoot && (
        <div className="text-[10px] font-mono uppercase tracking-wider mb-1 opacity-80" style={{ color: color.text }}>
          Root
        </div>
      )}
      {node.code && (
        <div
          className="text-[10px] font-mono font-semibold tracking-wide mb-1"
          style={{ color: color.text }}
        >
          {node.code}
        </div>
      )}
      <div className="flex items-start gap-1.5">
        <div
          className={`flex-1 min-w-0 text-[var(--color-text-primary)] leading-snug ${TITLE_SIZES[level]}`}
        >
          {node.title}
        </div>
        {hiddenCount > 0 && (
          <span className="shrink-0 mt-px rounded-full border border-[#475569] px-1.5 py-px text-[9px] font-mono font-semibold leading-tight text-[#94a3b8]">
            +{hiddenCount}
          </span>
        )}
        {node.children.length > 0 && (
          <button
            type="button"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // jangan buka DetailPanel — chevron hanya toggle collapse
              onToggle?.(node.id);
            }}
            onKeyDown={(e) => e.stopPropagation()} // mencegah aktivasi node dari Enter/Spasi
            className="shrink-0 -m-0.5 rounded p-0.5 text-[#94a3b8] transition-colors hover:text-[#e2e8f0] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-interactive)]"
          >
            {isCollapsed ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
          </button>
        )}
      </div>
      {!isCollapsed && node.children.length > 0 && (
        <div className="mt-1.5 text-[10px] font-mono text-[var(--color-text-muted)]">
          {node.children.length} ▸
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!opacity-0" isConnectable={false} />
    </div>
  );
}

const nodeTypes = { wbs: WbsNodeCard } as const;

/* ---------- Global component props (stabil) ---------- */
const backgroundProps = { color: "#1f1f24", gap: 18 } as const;
const minimapProps = {
  bgColor: "#111113",
  maskColor: "rgba(8, 8, 9, 0.82)",
  pannable: true,
  zoomable: true,
} as const;

export function WbsCanvas({ content, prdMode, language, onSelect }: WbsCanvasProps) {
  const [selected, setSelected] = useState<WbsNode | null>(null);
  // Tree diparsing sekali; state collapse tidak ikut reset saat tree berubah.
  const tree = useMemo(() => extractWbs(content, prdMode), [content, prdMode]);
  // State lokal — reset otomatis saat tab WBS ditutup/dibuka ulang (tidak persist).
  // Default: pohon UTUH ter-expand (kosong) — pola referensi; user bisa collapse manual.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const handleSelect = useCallback(
    (node: WbsNode) => {
      setSelected(node);
      onSelect?.(node);
    },
    [onSelect],
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const { nodes: n, edges: e } = layout(tree, handleSelect, toggleCollapse, collapsed);
    return { nodes: n, edges: e };
  }, [tree, handleSelect, toggleCollapse, collapsed]);

  const onNodeClick = useCallback(
    (_: import("react").MouseEvent, node: WbsFlowNode) => handleSelect(node.data.node),
    [handleSelect],
  );

  const nodeCount = useMemo(() => flattenWbs(tree.root).length, [tree]);

  return (
    <div className="relative flex flex-col h-full min-h-0 no-print">
      {/* Warnings banner — info, bukan error */}
      {tree.warnings.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-interactive-subtle)] text-[12px] text-[var(--color-text-secondary)] shrink-0">
          <Info size={13} strokeWidth={1.5} className="text-[var(--color-interactive)] shrink-0" />
          <span>{tree.warnings.join(" ")}</span>
        </div>
      )}

      {tree.root.children.length === 0 ? (
        /* Empty state — bukan canvas kosong */
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-4 text-center">
          <Network size={40} strokeWidth={1.5} className="text-[var(--color-text-muted)]" />
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            {language === "en"
              ? "No features detected in this PRD."
              : "Tidak ada fitur terdeteksi di PRD ini."}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
            nodesDraggable
            nodesConnectable={false}
            edgesReconnectable={false}
            deleteKeyCode={null}
            minZoom={0.3}
            maxZoom={2}
            className="bg-[var(--color-bg)]"
          >
            <Background {...backgroundProps} />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              {...minimapProps}
              nodeColor={(n) => {
                const w = (n as WbsFlowNode).data?.node;
                const level = (n as WbsFlowNode).data?.level ?? 0;
                if (!w) return "#3f3f46";
                if (level === 0) return ROOT_COLOR.stroke;
                if (level === 1) return "#64748b";
                if (level === 2) return (w.priority && PRIORITY_COLORS[w.priority]?.stroke) || "#52525b";
                return "#3f3f46";
              }}
            />
          </ReactFlow>
        </div>
      )}

      {/* Node counter — info kecil */}
      <div className="absolute top-3 right-3 text-[10px] font-mono text-[var(--color-text-muted)] pointer-events-none">
        {nodeCount} {language === "en" ? "nodes" : "node"}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <DetailPanel node={selected} language={language} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}