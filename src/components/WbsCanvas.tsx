import { useMemo, useState, useCallback, useLayoutEffect, useRef, type JSX } from "react";
import { AnimatePresence } from "motion/react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  useViewport,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Info,
  ChevronDown,
  ChevronRight,
  Network,
  Minus,
  Plus,
  Maximize2,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { extractWbs, flattenWbs, type WbsNode, type WbsPriority } from "../utils/wbs";
import type { ThemeMode } from "../utils/theme";
import { DetailPanel } from "./DetailPanel";
import { layout, type WbsFlowNode } from "./wbsLayout";

export interface WbsCanvasProps {
  content: string;
  prdMode?: "business" | "technical" | "simple";
  language: "id" | "en";
  theme?: ThemeMode;
  onSelect?: (node: WbsNode) => void;
  onJumpToDocument?: () => void;
  onAddWbsNote?: (nodeTitle: string) => void;
}

const PRIORITY_BADGES: Record<
  WbsPriority,
  { short: string; dotClass: string; badgeClass: string; darkStroke: string; lightStroke: string }
> = {
  "Must-have": {
    short: "MUST",
    dotClass: "bg-[var(--oa-signal-garnet)]",
    badgeClass:
      "bg-[var(--oa-signal-garnet-tint)] text-[var(--oa-signal-garnet)] border-[var(--oa-signal-garnet)]/35",
    darkStroke: "#C96A6E",
    lightStroke: "#9C3A3F",
  },
  "Should-have": {
    short: "SHOULD",
    dotClass: "bg-[var(--oa-signal-steel)]",
    badgeClass:
      "bg-[var(--oa-signal-steel-tint)] text-[var(--oa-signal-steel)] border-[var(--oa-signal-steel)]/35",
    darkStroke: "#7C9BB8",
    lightStroke: "#3B5B7A",
  },
  "Could-have": {
    short: "COULD",
    dotClass: "bg-[var(--oa-signal-ochre)]",
    badgeClass:
      "bg-[var(--oa-signal-ochre-tint)] text-[var(--oa-signal-ochre)] border-[var(--oa-signal-ochre)]/35",
    darkStroke: "#C29B61",
    lightStroke: "#8A652E",
  },
  "Won't-have": {
    short: "WONT",
    dotClass: "bg-[var(--oa-text-muted)]",
    badgeClass:
      "bg-[var(--oa-bg-recessed)] text-[var(--oa-text-muted)] border-[var(--oa-border-default)]",
    darkStroke: "#6B7282",
    lightStroke: "#6F7685",
  },
};

/* ---------- Node card (sizes matched 1:1 with wbsLayout.ts CARD_PROFILE) ---------- */
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
  const {
    node,
    level = 0,
    onActivate,
    onToggle,
    isCollapsed = false,
    hiddenCount = 0,
    onMeasure,
  } = data;

  const isRoot = level === 0;
  const isModule = level === 1;
  const isFeature = level === 2;
  const priorityInfo = node.priority ? PRIORITY_BADGES[node.priority] : undefined;

  // Measure actual DOM height so wbsLayout allocates exact vertical bands without overlap
  const cardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el && onMeasure) onMeasure(node.id, Math.max(0, el.offsetHeight));
  }, [node.id, node.title, node.code, node.children.length, isCollapsed, onMeasure]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    onActivate?.(node);
  };

  const levelClasses = isRoot
    ? "oa-elev-composer border-[var(--oa-border-champagne)]"
    : isModule || isFeature
      ? "oa-elev-sheet border-[var(--oa-border-default)]"
      : "bg-[var(--oa-bg-surface)] border border-[var(--oa-border-subtle)]";

  const selectedClasses = selected
    ? "border-[var(--oa-border-champagne)] oa-elev-popover ring-1 ring-[var(--oa-border-champagne)]/40"
    : "hover:border-[var(--oa-border-strong)]";

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${node.code ? `${node.code}: ` : ""}${node.title}`}
      className={`group rounded-xl transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] ${levelClasses} ${selectedClasses} ${CARD_SIZES[level] ?? CARD_SIZES[3]}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!opacity-0"
        isConnectable={false}
      />

      {isRoot && (
        <div className="text-[10px] font-mono uppercase tracking-[0.06em] mb-1 text-[var(--oa-text-champagne)]">
          ROOT
        </div>
      )}

      {(node.code || (isFeature && priorityInfo)) && (
        <div className="flex items-center justify-between gap-1.5 mb-1">
          {node.code ? (
            <span className="text-[10px] font-mono font-semibold tracking-wide text-[var(--oa-text-champagne)] truncate">
              {node.code}
            </span>
          ) : (
            <span />
          )}

          {isFeature && priorityInfo && (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[9px] font-mono uppercase tracking-[0.05em] shrink-0 ${priorityInfo.badgeClass}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityInfo.dotClass}`}
                aria-hidden="true"
              />
              <span>{priorityInfo.short}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-1.5">
        <div
          className={`flex-1 min-w-0 text-[var(--oa-text-primary)] leading-snug ${TITLE_SIZES[level] ?? TITLE_SIZES[3]}`}
        >
          {node.title}
        </div>
        {hiddenCount > 0 && (
          <span className="shrink-0 mt-px rounded-full bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] px-1.5 py-px text-[9px] font-mono font-semibold leading-tight text-[var(--oa-text-champagne)]">
            +{hiddenCount}
          </span>
        )}
        {node.children.length > 0 && (
          <button
            type="button"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle?.(node.id);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="shrink-0 -m-0.5 rounded p-0.5 text-[var(--oa-text-muted)] transition-colors hover:text-[var(--oa-text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--oa-accent-champagne)] cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {!isCollapsed && node.children.length > 0 && (
        <div className="mt-1.5 text-[10px] font-mono text-[var(--oa-text-muted)]">
          {node.children.length} ▸
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!opacity-0"
        isConnectable={false}
      />
    </div>
  );
}

const nodeTypes = { wbs: WbsNodeCard } as const;

function computeActiveEdgeIds(root: WbsNode, selectedId: string | null): Set<string> {
  const active = new Set<string>();
  if (!selectedId) return active;

  const path: WbsNode[] = [];
  const findPath = (curr: WbsNode): boolean => {
    path.push(curr);
    if (curr.id === selectedId) return true;
    for (const child of curr.children) {
      if (findPath(child)) return true;
    }
    path.pop();
    return false;
  };
  findPath(root);

  for (let i = 0; i < path.length - 1; i++) {
    active.add(`${path[i].id}→${path[i + 1].id}`);
  }

  const selectedNode = path[path.length - 1];
  if (selectedNode && selectedNode.id === selectedId) {
    const collectDescendants = (curr: WbsNode) => {
      for (const child of curr.children) {
        active.add(`${curr.id}→${child.id}`);
        collectDescendants(child);
      }
    };
    collectDescendants(selectedNode);
  }

  return active;
}

function computeBreadcrumb(root: WbsNode, targetId: string | null): string | undefined {
  if (!targetId) return undefined;
  const titles: string[] = [];
  const walk = (curr: WbsNode): boolean => {
    titles.push(curr.title);
    if (curr.id === targetId) return true;
    for (const child of curr.children) {
      if (walk(child)) return true;
    }
    titles.pop();
    return false;
  };
  return walk(root) ? titles.join(" / ") : undefined;
}

function WbsToolbar({
  language,
  nodeCount,
  allModulesCollapsed,
  hasCollapsibleModules,
  onToggleAllModules,
}: {
  language: "id" | "en";
  nodeCount: number;
  allModulesCollapsed: boolean;
  hasCollapsibleModules: boolean;
  onToggleAllModules: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="absolute bottom-4 left-4 z-10 oa-elev-popover rounded-xl px-2 py-1.5 flex flex-wrap items-center gap-1 select-none pointer-events-auto">
      <button
        type="button"
        onClick={() => zoomOut({ duration: 160 })}
        aria-label={language === "en" ? "Zoom out" : "Perkecil"}
        title={language === "en" ? "Zoom out" : "Perkecil"}
        className="p-1.5 rounded-lg text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
      >
        <Minus size={13} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <span className="min-w-[42px] text-center text-[11px] font-mono text-[var(--oa-text-primary)]">
        {Math.round(zoom * 100)}%
      </span>

      <button
        type="button"
        onClick={() => zoomIn({ duration: 160 })}
        aria-label={language === "en" ? "Zoom in" : "Perbesar"}
        title={language === "en" ? "Zoom in" : "Perbesar"}
        className="p-1.5 rounded-lg text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
      >
        <Plus size={13} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <span className="w-px h-4 bg-[var(--oa-border-subtle)] mx-0.5" aria-hidden="true" />

      <button
        type="button"
        onClick={() => fitView({ padding: 0.15, duration: 240 })}
        aria-label={language === "en" ? "Fit view" : "Sesuaikan tampilan"}
        title={language === "en" ? "Fit view" : "Sesuaikan tampilan"}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
      >
        <Maximize2 size={12} strokeWidth={1.6} aria-hidden="true" />
        <span className="hidden sm:inline">
          {language === "en" ? "Fit view" : "Pas layar"}
        </span>
      </button>

      {hasCollapsibleModules && (
        <>
          <span className="w-px h-4 bg-[var(--oa-border-subtle)] mx-0.5" aria-hidden="true" />
          <button
            type="button"
            onClick={onToggleAllModules}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
          >
            {allModulesCollapsed ? (
              <ChevronsUpDown size={12} strokeWidth={1.6} aria-hidden="true" />
            ) : (
              <ChevronsDownUp size={12} strokeWidth={1.6} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {allModulesCollapsed
                ? language === "en"
                  ? "Expand all"
                  : "Buka semua"
                : language === "en"
                  ? "Collapse all"
                  : "Tutup semua"}
            </span>
          </button>
        </>
      )}

      <span className="w-px h-4 bg-[var(--oa-border-subtle)] mx-0.5" aria-hidden="true" />

      <span className="px-1.5 text-[10.5px] font-mono text-[var(--oa-text-muted)]">
        {nodeCount} {language === "en" ? "nodes" : "node"}
      </span>
    </div>
  );
}

export function WbsCanvas({
  content,
  prdMode,
  language,
  theme = "dark",
  onSelect,
  onJumpToDocument,
  onAddWbsNote,
}: WbsCanvasProps): JSX.Element {
  const [selected, setSelected] = useState<WbsNode | null>(null);
  const tree = useMemo(() => extractWbs(content, prdMode), [content, prdMode]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});

  const handleMeasure = useCallback((id: string, height: number) => {
    setNodeHeights((prev) => {
      if (Math.abs((prev[id] ?? 0) - height) < 0.5) return prev;
      return { ...prev, [id]: height };
    });
  }, []);

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

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    const { nodes: n, edges: e } = layout(
      tree,
      handleSelect,
      toggleCollapse,
      collapsed,
      nodeHeights,
      handleMeasure,
    );
    return { nodes: n, edges: e };
  }, [tree, handleSelect, toggleCollapse, collapsed, nodeHeights, handleMeasure]);

  const nodes = useMemo(
    () =>
      layoutNodes.map((n) => ({
        ...n,
        selected: n.id === selected?.id,
      })),
    [layoutNodes, selected?.id],
  );

  const activeEdgeIds = useMemo(
    () => computeActiveEdgeIds(tree.root, selected?.id ?? null),
    [tree.root, selected?.id],
  );

  const styledEdges = useMemo(() => {
    const activeStroke = theme === "dark" ? "#B89E74" : "#7E643E";
    const baseStroke =
      theme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(14,16,21,0.18)";
    return layoutEdges.map((edge) => {
      const isPath = activeEdgeIds.has(edge.id);
      return {
        ...edge,
        zIndex: isPath ? 10 : 0,
        style: {
          ...edge.style,
          stroke: isPath ? activeStroke : baseStroke,
          strokeWidth: isPath ? 2.2 : 1.5,
        },
      };
    });
  }, [layoutEdges, activeEdgeIds, theme]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: WbsFlowNode) => handleSelect(node.data.node),
    [handleSelect],
  );

  const nodeCount = useMemo(() => flattenWbs(tree.root).length, [tree]);

  const level1ModuleIds = useMemo(
    () =>
      tree.root.children
        .filter((c) => c.children.length > 0)
        .map((c) => c.id),
    [tree.root.children],
  );

  const allModulesCollapsed =
    level1ModuleIds.length > 0 &&
    level1ModuleIds.every((id) => collapsed.has(id));

  const handleToggleAllModules = useCallback(() => {
    setCollapsed((prev) => {
      const allNowCollapsed =
        level1ModuleIds.length > 0 &&
        level1ModuleIds.every((id) => prev.has(id));
      return allNowCollapsed ? new Set() : new Set(level1ModuleIds);
    });
  }, [level1ModuleIds]);

  const selectedBreadcrumb = useMemo(
    () => computeBreadcrumb(tree.root, selected?.id ?? null),
    [tree.root, selected?.id],
  );

  return (
    <div className="relative flex flex-col h-full min-h-0 no-print">
      {/* Warnings banner - info, not error */}
      {tree.warnings.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--oa-signal-ochre)]/30 bg-[var(--oa-signal-ochre-tint)] text-[12px] text-[var(--oa-text-secondary)] shrink-0">
          <Info
            size={13}
            strokeWidth={1.6}
            className="text-[var(--oa-signal-ochre)] shrink-0"
            aria-hidden="true"
          />
          <span>{tree.warnings.join(" ")}</span>
        </div>
      )}

      {tree.root.children.length === 0 ? (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-4 text-center">
          <Network
            size={40}
            strokeWidth={1.5}
            className="text-[var(--oa-text-muted)]"
            aria-hidden="true"
          />
          <p className="text-[13px] text-[var(--oa-text-secondary)]">
            {language === "en"
              ? "No features detected in this PRD."
              : "Tidak ada fitur terdeteksi di PRD ini."}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={styledEdges}
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
            className="bg-[var(--oa-bg-canvas)]"
          >
            <Background
              color={
                theme === "dark"
                  ? "rgba(255,255,255,0.11)"
                  : "rgba(14,16,21,0.14)"
              }
              gap={18}
            />
            <MiniMap
              bgColor={theme === "dark" ? "#12151B" : "#EAEBEF"}
              maskColor={
                theme === "dark"
                  ? "rgba(8,9,12,0.78)"
                  : "rgba(226,228,233,0.76)"
              }
              pannable
              zoomable
              nodeColor={(n) => {
                const w = (n as WbsFlowNode).data?.node;
                const level = (n as WbsFlowNode).data?.level ?? 0;
                if (!w) return theme === "dark" ? "#282E3B" : "#B8BEC9";
                if (level === 0) return theme === "dark" ? "#B89E74" : "#7E643E";
                if (level === 1) return theme === "dark" ? "#6B7282" : "#6F7685";
                if (level === 2) {
                  const p = w.priority ? PRIORITY_BADGES[w.priority] : undefined;
                  if (p) return theme === "dark" ? p.darkStroke : p.lightStroke;
                  return theme === "dark" ? "#4D5361" : "#8B92A0";
                }
                return theme === "dark" ? "#282E3B" : "#B8BEC9";
              }}
            />
            <WbsToolbar
              language={language}
              nodeCount={nodeCount}
              allModulesCollapsed={allModulesCollapsed}
              hasCollapsibleModules={level1ModuleIds.length > 0}
              onToggleAllModules={handleToggleAllModules}
            />
          </ReactFlow>
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <DetailPanel
            node={selected}
            language={language}
            theme={theme}
            breadcrumb={selectedBreadcrumb}
            onClose={() => setSelected(null)}
            onOpenDocument={onJumpToDocument}
            onAddNote={onAddWbsNote}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
