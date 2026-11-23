import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges, snapCenterToCursor } from "@dnd-kit/modifiers";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  AlertTriangle,
  Layers,
  Ban,
  ListChecks,
  Users,
  Palette,
  Server,
  Database,
  Webhook,
  LayoutTemplate,
  ShieldCheck,
  Gauge,
  Rocket,
  ShieldAlert,
  CalendarRange,
  Scale,
  FlaskConical,
  RefreshCcw,
  Bot,
  HelpCircle,
  BookOpen,
  UserRound,
  Link2,
  Lock,
  BarChart3,
  ServerCog,
  Smartphone,
  GitMerge,
  X,
  GripVertical,
  RotateCcw,
  Library,
  Layers2,
  Sliders,
  Plus,
  Check,
} from "lucide-react";
import {
  CHAPTER_BLOCKS,
  MAX_CUSTOM_BLOCKS,
  findOrderIssues,
  getChapterBlock,
} from "../../shared/chapterBlocks";
import type { ChapterBlock } from "../../shared/chapterBlocks";
import { safeSetLocalStorage } from "../utils/storage";
import { EXPO_MORPH } from "../utils/motion";
import { useT } from "../hooks/useT";

// Explicit icon map for every registry icon (unknown names fall back to FileText)
const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
> = {
  BookOpen,
  UserRound,
  Link2,
  Lock,
  BarChart3,
  ServerCog,
  Smartphone,
  GitMerge,
  FileText,
  AlertTriangle,
  Layers,
  Ban,
  ListChecks,
  Users,
  Palette,
  Server,
  Database,
  Webhook,
  LayoutTemplate,
  ShieldCheck,
  Gauge,
  Rocket,
  ShieldAlert,
  CalendarRange,
  Scale,
  FlaskConical,
  RefreshCcw,
  Bot,
  HelpCircle,
};

const STORAGE_KEY_BLOCKS = "PRD_CUSTOM_BLOCKS";
const STORAGE_DEBOUNCE_MS = 400;

type CategoryFilter = "all" | "product" | "technical";

function BlockIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Cmp = ICON_MAP[name] ?? FileText;
  return <Cmp size={size} strokeWidth={1.65} className="shrink-0" aria-hidden="true" />;
}

function getCategoryDotClass(category: ChapterBlock["category"]): string {
  return category === "product"
    ? "bg-[var(--oa-signal-ochre)]"
    : "bg-[var(--oa-signal-steel)]";
}

function DroppablePanel({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-over={isOver ? "true" : "false"} className={className}>
      {children}
    </div>
  );
}

// -- Library card (draggable + clickable when unselected and under limit) --

function LibraryCard({
  block,
  lang,
  isSelected,
  isFull,
  onAdd,
  lastDragEndRef,
}: {
  block: ChapterBlock;
  lang: "en" | "id";
  isSelected: boolean;
  isFull: boolean;
  onAdd: () => void;
  lastDragEndRef: React.MutableRefObject<number>;
}) {
  const disabled = isSelected || isFull;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `lib-${block.id}`,
      data: { type: "library", blockId: block.id },
      disabled,
    });

  const title = lang === "en" ? block.titleEn : block.titleId;
  const desc = lang === "en" ? block.descEn : block.descId;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : isSelected ? 0.55 : isFull ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!disabled ? listeners : {})}
      {...(!disabled ? attributes : {})}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={
        isSelected
          ? lang === "en"
            ? `${title} selected`
            : `${title} terpilih`
          : lang === "en"
            ? `Add ${title}`
            : `Tambah ${title}`
      }
      aria-disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (Date.now() - lastDragEndRef.current < 250) return;
        onAdd();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAdd();
        }
      }}
      className={`group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] ${
        disabled
          ? "border-[var(--oa-border-subtle)] bg-[var(--oa-bg-surface)]/70 cursor-default"
          : "border-[var(--oa-border-default)] bg-[var(--oa-bg-surface)] hover:border-[var(--oa-border-champagne)]/70 hover:bg-[var(--oa-bg-elevated)] cursor-grab active:cursor-grabbing"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${getCategoryDotClass(block.category)}`}
        aria-hidden="true"
      />
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--oa-border-subtle)] bg-[var(--oa-bg-elevated)] text-[var(--oa-text-secondary)] group-hover:text-[var(--oa-text-primary)]"
        aria-hidden="true"
      >
        <BlockIcon name={block.icon} size={13} />
      </span>

      <div className="min-w-0 flex-1 pointer-events-none">
        <div className="text-[12.5px] font-medium leading-snug text-[var(--oa-text-primary)] truncate">
          {title}
        </div>
        <div className="text-[11px] leading-snug text-[var(--oa-text-secondary)] truncate">
          {desc}
        </div>
      </div>

      <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md pointer-events-none">
        {isSelected ? (
          <Check
            size={13}
            strokeWidth={2}
            className="text-[var(--oa-signal-sage)]"
            aria-hidden="true"
          />
        ) : (
          <Plus
            size={13}
            strokeWidth={1.75}
            className="text-[var(--oa-text-muted)] group-hover:text-[var(--oa-accent-champagne)] transition-colors"
            aria-hidden="true"
          />
        )}
      </span>
    </div>
  );
}

// -- Selected card (sortable, numbered, explicit remove + drop indicator) --

function SelectedCard({
  block,
  index,
  lang,
  isFlagged,
  orderBadgeLabel,
  showDropLine,
  onRemove,
  lastDragEndRef,
}: {
  block: ChapterBlock;
  index: number;
  lang: "en" | "id";
  isFlagged: boolean;
  orderBadgeLabel: string;
  showDropLine: boolean;
  onRemove: () => void;
  lastDragEndRef: React.MutableRefObject<number>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `sel-${block.id}`,
      data: { type: "selected", blockId: block.id },
    });

  const title = lang === "en" ? block.titleEn : block.titleId;
  const desc = lang === "en" ? block.descEn : block.descId;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-2.5 rounded-xl border bg-[var(--oa-bg-elevated)] p-2.5 text-left shadow-subtle transition-colors hover:border-[var(--oa-border-strong)] ${
        isDragging
          ? "border-[var(--oa-border-champagne)] ring-1 ring-[var(--oa-border-champagne)]/40"
          : "border-[var(--oa-border-default)]"
      }`}
    >
      {showDropLine && (
        <div
          className="absolute -top-1.5 left-2 right-2 h-[2px] rounded-full bg-[var(--oa-accent-champagne)] pointer-events-none z-20"
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={
          lang === "en"
            ? `Drag to reorder ${title}`
            : `Seret untuk ubah urutan ${title}`
        }
        className="flex h-7 w-5 shrink-0 items-center justify-center rounded-md text-[var(--oa-text-muted)] hover:text-[var(--oa-text-primary)] cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
      >
        <GripVertical size={13} strokeWidth={1.6} aria-hidden="true" />
      </button>

      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[10.5px] font-mono font-medium text-[var(--oa-text-champagne)]">
        {String(index + 1).padStart(2, "0")}
      </span>

      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${getCategoryDotClass(block.category)}`}
        aria-hidden="true"
      />

      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--oa-text-secondary)]"
        aria-hidden="true"
      >
        <BlockIcon name={block.icon} size={13} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-[12.5px] font-medium text-[var(--oa-text-primary)]">
            {title}
          </span>
          {isFlagged && (
            <span className="shrink-0 rounded-md border border-[var(--oa-signal-ochre)]/35 bg-[var(--oa-signal-ochre-tint)] px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-[0.05em] text-[var(--oa-signal-ochre)]">
              {orderBadgeLabel}
            </span>
          )}
        </div>
        <span className="block truncate text-[11px] leading-snug text-[var(--oa-text-secondary)]">
          {desc}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (Date.now() - lastDragEndRef.current < 250) return;
          onRemove();
        }}
        aria-label={lang === "en" ? `Remove ${title}` : `Hapus ${title}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--oa-text-muted)] hover:bg-[var(--oa-signal-garnet-tint)] hover:text-[var(--oa-signal-garnet)] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none touch-manipulation"
      >
        <X size={13} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

function OverlayCard({
  block,
  lang,
  movingLabel,
}: {
  block: ChapterBlock;
  lang: "en" | "id";
  movingLabel: string;
}) {
  const title = lang === "en" ? block.titleEn : block.titleId;
  return (
    <div className="oa-elev-popover flex items-center gap-2.5 rounded-xl border-[var(--oa-border-champagne)] px-3 py-2.5 rotate-[1deg]">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[var(--oa-text-secondary)]">
        <BlockIcon name={block.icon} size={13} />
      </span>
      <span className="max-w-[200px] truncate text-[12px] font-medium text-[var(--oa-text-primary)]">
        {title}
      </span>
      <span className="ml-1 rounded-md border border-[var(--oa-border-champagne)] bg-[var(--oa-accent-champagne-tint)] px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-champagne)]">
        {movingLabel}
      </span>
    </div>
  );
}

export function CustomPrdBuilder({
  language,
  selectedIds,
  onChangeSelectedIds,
}: {
  language: "en" | "id";
  selectedIds: string[];
  onChangeSelectedIds: (ids: string[]) => void;
}) {
  const t = useT(language);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const confirmTimerRef = useRef<number | null>(null);
  const lastDragEndRef = useRef<number>(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Controlled persistence: debounced write remains in builder for backwards compat
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      safeSetLocalStorage(STORAGE_KEY_BLOCKS, JSON.stringify(selectedIds));
    }, STORAGE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [selectedIds]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const selectedBlocks = useMemo(
    () =>
      selectedIds
        .map((id) => getChapterBlock(id))
        .filter((b): b is ChapterBlock => Boolean(b)),
    [selectedIds],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredLibraryGroups = useMemo(() => {
    return {
      product:
        categoryFilter === "all" || categoryFilter === "product"
          ? CHAPTER_BLOCKS.filter((b) => b.category === "product")
          : [],
      technical:
        categoryFilter === "all" || categoryFilter === "technical"
          ? CHAPTER_BLOCKS.filter((b) => b.category === "technical")
          : [],
    };
  }, [categoryFilter]);

  const visibleLibraryItems = useMemo(
    () => [
      ...filteredLibraryGroups.product.map((b) => `lib-${b.id}`),
      ...filteredLibraryGroups.technical.map((b) => `lib-${b.id}`),
    ],
    [filteredLibraryGroups],
  );

  const isFull = selectedIds.length >= MAX_CUSTOM_BLOCKS;

  const addBlock = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) return;
      if (selectedIds.length >= MAX_CUSTOM_BLOCKS) return;
      if (!getChapterBlock(id)) return;
      onChangeSelectedIds([...selectedIds, id]);
    },
    [selectedIds, onChangeSelectedIds],
  );

  const removeBlock = useCallback(
    (id: string) => {
      onChangeSelectedIds(selectedIds.filter((x) => x !== id));
    },
    [selectedIds, onChangeSelectedIds],
  );

  const startConfirmReset = useCallback(() => {
    setConfirmReset(true);
    if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = window.setTimeout(() => setConfirmReset(false), 3000);
  }, []);

  const cancelConfirmReset = useCallback(() => {
    setConfirmReset(false);
    if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
  }, []);

  const executeReset = useCallback(() => {
    onChangeSelectedIds([]);
    setConfirmReset(false);
    if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
  }, [onChangeSelectedIds]);

  const parseId = (raw: string): { kind: "lib" | "sel"; blockId: string } | null => {
    if (raw.startsWith("lib-")) return { kind: "lib", blockId: raw.slice(4) };
    if (raw.startsWith("sel-")) return { kind: "sel", blockId: raw.slice(4) };
    return null;
  };

  const handleDragStart = (e: DragStartEvent) => {
    lastDragEndRef.current = Date.now();
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    lastDragEndRef.current = Date.now();
    setActiveId(null);
    setOverId(null);
    if (!over) return;
    const a = parseId(String(active.id));
    const o = parseId(String(over.id));
    const overIsLibraryPanel = String(over.id) === "panel-library";
    const overIsSelectedPanel = String(over.id) === "panel-selected";

    if (!a) return;

    if (a.kind === "lib") {
      if (o?.kind === "sel" || overIsSelectedPanel) {
        if (selectedSet.has(a.blockId)) return;
        if (selectedIds.length >= MAX_CUSTOM_BLOCKS) return;
        if (overIsSelectedPanel) {
          addBlock(a.blockId);
          return;
        }
        if (o && o.kind === "sel") {
          const overIndex = selectedIds.indexOf(o.blockId);
          if (overIndex === -1) {
            addBlock(a.blockId);
          } else {
            if (
              selectedIds.includes(a.blockId) ||
              selectedIds.length >= MAX_CUSTOM_BLOCKS
            ) {
              return;
            }
            const next = [...selectedIds];
            next.splice(overIndex, 0, a.blockId);
            onChangeSelectedIds(next);
          }
        }
        return;
      }
      return;
    }

    if (a.kind === "sel" && o?.kind === "sel") {
      const oldIndex = selectedIds.indexOf(a.blockId);
      const newIndex = selectedIds.indexOf(o.blockId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onChangeSelectedIds(arrayMove(selectedIds, oldIndex, newIndex));
      }
      return;
    }

    if (a.kind === "sel" && (o?.kind === "lib" || overIsLibraryPanel)) {
      removeBlock(a.blockId);
      return;
    }
  };

  const activeBlock: ChapterBlock | undefined = useMemo(() => {
    if (!activeId) return undefined;
    const parsed = parseId(activeId);
    if (!parsed) return undefined;
    return getChapterBlock(parsed.blockId);
  }, [activeId]);

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  }, []);

  const counterText = `${selectedIds.length}/${MAX_CUSTOM_BLOCKS}`;

  const orderIssues = useMemo(
    () => findOrderIssues(selectedIds),
    [selectedIds],
  );

  const flaggedIds = useMemo(
    () => new Set(orderIssues.map((issue) => issue.blockId)),
    [orderIssues],
  );

  const orderWarnings = useMemo(() => {
    const titleOf = (id: string) => {
      const b = getChapterBlock(id);
      return b ? (language === "en" ? b.titleEn : b.titleId) : id;
    };
    return orderIssues.map((issue) =>
      t.builder.orderWarningItem
        .replace("{block}", titleOf(issue.blockId))
        .replace("{sources}", issue.sourceIds.map(titleOf).join(", ")),
    );
  }, [orderIssues, language, t]);

  const filterOptions: Array<{ key: CategoryFilter; label: string }> = [
    { key: "all", label: `${t.builder.filterAll} (${CHAPTER_BLOCKS.length})` },
    { key: "product", label: t.builder.productGroup },
    { key: "technical", label: t.builder.technicalGroup },
  ];

  const availableCount = CHAPTER_BLOCKS.filter((b) => !selectedSet.has(b.id)).length;

  return (
    <div className="w-full space-y-3">
      {/* Workbench Header Bar */}
      <div className="oa-elev-sheet rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] text-[var(--oa-accent-champagne)]">
            <Sliders size={14} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className="text-[13px] font-semibold text-[var(--oa-text-primary)] truncate">
            {t.builder.selectedTitle}
          </span>
          <span className="inline-flex items-center rounded-full border border-[var(--oa-border-champagne)] bg-[var(--oa-accent-champagne-tint)] px-2.5 py-0.5 text-[10.5px] font-mono font-medium text-[var(--oa-text-champagne)] shrink-0">
            {selectedIds.length} / {MAX_CUSTOM_BLOCKS} {t.builder.chaptersUnit}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Segmented Filter */}
          <div
            role="tablist"
            aria-label={t.builder.libraryTitle}
            className="oa-recessed-well flex items-center gap-0.5 p-0.5 rounded-lg"
          >
            {filterOptions.map((opt) => {
              const isSelected = categoryFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setCategoryFilter(opt.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none ${
                    isSelected
                      ? "bg-[var(--oa-bg-elevated)] text-[var(--oa-text-primary)] shadow-subtle"
                      : "text-[var(--oa-text-muted)] hover:text-[var(--oa-text-secondary)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Inline Garnet Reset Confirmation */}
          {confirmReset ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--oa-signal-garnet)]/45 bg-[var(--oa-signal-garnet-tint)] p-0.5">
              <button
                type="button"
                onClick={executeReset}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[var(--oa-signal-garnet)] hover:bg-[var(--oa-signal-garnet)] hover:text-[#F2F3F5] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-signal-garnet)] focus-visible:outline-none"
              >
                {t.builder.confirmReset}
              </button>
              <button
                type="button"
                onClick={cancelConfirmReset}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:bg-[var(--oa-bg-hover)]/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
              >
                {t.builder.cancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startConfirmReset}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--oa-border-default)] bg-[var(--oa-bg-elevated)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] hover:border-[var(--oa-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none"
            >
              <RotateCcw size={12} strokeWidth={1.6} aria-hidden="true" />
              <span>{t.builder.reset}</span>
            </button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          {/* Left: Recessed Library Well */}
          <DroppablePanel
            id="panel-library"
            className={`oa-recessed-well rounded-2xl p-3.5 transition-colors ${
              overId === "panel-library" ? "border-[var(--oa-border-champagne)]" : ""
            }`}
          >
            <div className="mb-3 flex items-center gap-2 px-0.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--oa-bg-surface)] border border-[var(--oa-border-subtle)] text-[var(--oa-text-muted)]">
                <Library size={12} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <h3 className="text-[11.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-primary)]">
                {t.builder.libraryTitle}
              </h3>
              <span className="ml-auto text-[11px] font-mono text-[var(--oa-text-muted)]">
                {availableCount} {language === "en" ? "available" : "tersedia"}
              </span>
            </div>

            <SortableContext
              id="library-sortable"
              items={visibleLibraryItems}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {filteredLibraryGroups.product.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 px-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--oa-signal-ochre)]"
                        aria-hidden="true"
                      />
                      <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
                        {t.builder.productGroup}
                      </span>
                      <span className="h-px flex-1 bg-[var(--oa-border-subtle)]" aria-hidden="true" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {filteredLibraryGroups.product.map((block) => (
                        <LibraryCard
                          key={block.id}
                          block={block}
                          lang={language}
                          isSelected={selectedSet.has(block.id)}
                          isFull={isFull}
                          onAdd={() => addBlock(block.id)}
                          lastDragEndRef={lastDragEndRef}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredLibraryGroups.technical.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 px-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--oa-signal-steel)]"
                        aria-hidden="true"
                      />
                      <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
                        {t.builder.technicalGroup}
                      </span>
                      <span className="h-px flex-1 bg-[var(--oa-border-subtle)]" aria-hidden="true" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {filteredLibraryGroups.technical.map((block) => (
                        <LibraryCard
                          key={block.id}
                          block={block}
                          lang={language}
                          isSelected={selectedSet.has(block.id)}
                          isFull={isFull}
                          onAdd={() => addBlock(block.id)}
                          lastDragEndRef={lastDragEndRef}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SortableContext>

            {isFull && (
              <p className="mt-3 rounded-xl border border-[var(--oa-signal-ochre)]/35 bg-[var(--oa-signal-ochre-tint)] px-3 py-2 text-[11.5px] leading-snug text-[var(--oa-signal-ochre)]">
                {t.builder.limitHint}
              </p>
            )}
            <p className="mt-2.5 px-0.5 text-[11px] leading-snug text-[var(--oa-text-muted)]">
              {t.builder.libraryHint}
            </p>
          </DroppablePanel>

          {/* Right: Selected Ordered Chapters Sheet */}
          <DroppablePanel
            id="panel-selected"
            className={`oa-elev-sheet rounded-2xl p-3.5 min-h-[340px] transition-colors ${
              overId === "panel-selected" ||
              Boolean(activeId?.startsWith("lib-") && overId?.startsWith("sel-"))
                ? "border-[var(--oa-border-champagne)]"
                : ""
            }`}
          >
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 px-0.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--oa-accent-champagne-tint)] border border-[var(--oa-border-champagne)] text-[var(--oa-text-champagne)]">
                  <Layers2 size={12} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h3 className="text-[11.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-primary)]">
                  {t.builder.selectedTitle}
                </h3>
                <span className="ml-auto rounded-full bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] px-2 py-0.5 text-[11px] font-mono text-[var(--oa-text-secondary)]">
                  {counterText}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-[var(--oa-bg-recessed)] border border-[var(--oa-border-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--oa-accent-champagne)] transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, (selectedIds.length / MAX_CUSTOM_BLOCKS) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {orderWarnings.length > 0 && (
              <div
                role="status"
                className="mb-3 rounded-xl border border-[var(--oa-signal-ochre)]/35 bg-[var(--oa-signal-ochre-tint)] px-3 py-2.5 text-[11.5px] leading-snug text-[var(--oa-signal-ochre)]"
              >
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" />
                  <span>{t.builder.orderWarningTitle}</span>
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-[var(--oa-text-secondary)]">
                  {orderWarnings.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            )}

            <SortableContext
              id="selected-sortable"
              items={selectedIds.map((id) => `sel-${id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {selectedBlocks.map((block, idx) => (
                    <motion.div
                      key={block.id}
                      layout
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={EXPO_MORPH}
                    >
                      <SelectedCard
                        block={block}
                        index={idx}
                        lang={language}
                        isFlagged={flaggedIds.has(block.id)}
                        orderBadgeLabel={t.builder.orderBadge}
                        showDropLine={Boolean(
                          activeId &&
                            overId === `sel-${block.id}` &&
                            activeId !== `sel-${block.id}`,
                        )}
                        onRemove={() => removeBlock(block.id)}
                        lastDragEndRef={lastDragEndRef}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {selectedBlocks.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--oa-border-default)] bg-[var(--oa-bg-recessed)]/50 px-6 py-10 text-center">
                    <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--oa-bg-elevated)] border border-[var(--oa-border-subtle)] text-[var(--oa-text-muted)]">
                      <Layers size={16} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <p className="max-w-[260px] text-[12.5px] font-medium text-[var(--oa-text-primary)]">
                      {t.builder.emptyTitle}
                    </p>
                    <p className="mt-1 max-w-[260px] text-[11.5px] leading-snug text-[var(--oa-text-secondary)]">
                      {t.builder.emptyDesc}
                    </p>
                  </div>
                )}

                {activeId?.startsWith("lib-") && selectedBlocks.length > 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--oa-border-champagne)] bg-[var(--oa-accent-champagne-tint)] px-3 py-2 text-center text-[11px] font-mono text-[var(--oa-text-champagne)]">
                    {t.builder.dropHint}
                  </div>
                )}
              </div>
            </SortableContext>

            {selectedBlocks.length > 0 && (
              <p className="mt-3 px-0.5 text-[11px] leading-snug text-[var(--oa-text-muted)]">
                {t.builder.canvasHint}
              </p>
            )}
          </DroppablePanel>
        </div>

        <DragOverlay
          modifiers={[snapCenterToCursor]}
          dropAnimation={{
            duration: 180,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {activeBlock ? (
            <OverlayCard
              block={activeBlock}
              lang={language}
              movingLabel={t.builder.movingBadge}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
