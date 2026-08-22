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
  X,
  GripVertical,
  RotateCcw,
  Library,
  Layers2,
} from "lucide-react";
import { CHAPTER_BLOCKS, MAX_CUSTOM_BLOCKS, getChapterBlock } from "../../shared/chapterBlocks";
import type { ChapterBlock } from "../../shared/chapterBlocks";
import { safeSetLocalStorage } from "../utils/storage";
import { useT } from "../hooks/useT";

// icon map explicit for all 21 registry icons
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
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

function BlockIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Cmp = ICON_MAP[name] ?? FileText;
  return <Cmp size={size} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />;
}

function categoryLabel(block: ChapterBlock, lang: "en" | "id") {
  if (lang === "en") return block.category === "product" ? "Product" : "Technical";
  return block.category === "product" ? "Produk" : "Teknis";
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

// -- Library card (draggable + clickable) --

function LibraryCard({
  block,
  lang,
  disabled,
  onAdd,
  lastDragEndRef,
}: {
  block: ChapterBlock;
  lang: "en" | "id";
  disabled: boolean;
  onAdd: () => void;
  lastDragEndRef: React.MutableRefObject<number>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `lib-${block.id}`,
    data: { type: "library", blockId: block.id },
    disabled,
  });

  const title = lang === "en" ? block.titleEn : block.titleId;
  const desc = lang === "en" ? block.descEn : block.descId;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : disabled ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!disabled ? listeners : {})}
      {...attributes}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={lang === "en" ? `Add ${title}` : `Tambah ${title}`}
      aria-disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (Date.now() - lastDragEndRef.current < 250) return;
        onAdd();
      }}
      className={`group relative flex flex-col gap-1.5 rounded-xl border bg-[var(--color-surface)] p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] ${
        disabled
          ? "border-[var(--color-border)] cursor-not-allowed"
          : "border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-elevated)] cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        <span
          className="pointer-events-none relative z-10 flex h-7 w-7 items-center justify-center rounded-lg border bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
          aria-hidden="true"
        >
          <BlockIcon name={block.icon} size={13} />
        </span>
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${
            block.category === "product"
              ? "border-[var(--color-mode-business)]/20 bg-[var(--color-mode-business-bg)] text-[var(--color-mode-business)]"
              : "border-[var(--color-mode-technical)]/20 bg-[var(--color-mode-technical-bg)] text-[var(--color-mode-technical)]"
          }`}
        >
          {categoryLabel(block, lang)}
        </span>
      </div>
      <span className="pointer-events-none text-[12.5px] font-medium leading-snug text-[var(--color-text-primary)] line-clamp-2">
        {title}
      </span>
      <span className="pointer-events-none text-[11px] leading-snug text-[var(--color-text-secondary)] line-clamp-2">
        {desc}
      </span>
      {!disabled && (
        <span className="pointer-events-none absolute bottom-2 right-2 text-[var(--color-text-muted)] opacity-40 group-hover:opacity-100 transition-opacity">
          <GripVertical size={12} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}

// -- Selected card (sortable, numbered, removable) --

function SelectedCard({
  block,
  index,
  lang,
  onRemove,
  lastDragEndRef,
}: {
  block: ChapterBlock;
  index: number;
  lang: "en" | "id";
  onRemove: () => void;
  lastDragEndRef: React.MutableRefObject<number>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `sel-${block.id}`,
    data: { type: "selected", blockId: block.id },
  });

  const title = lang === "en" ? block.titleEn : block.titleId;
  const desc = lang === "en" ? block.descEn : block.descId;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => {
        if (Date.now() - lastDragEndRef.current < 250) return;
        onRemove();
      }}
      className={`group relative flex gap-3 rounded-xl border bg-[var(--color-surface-elevated)] p-3 text-left shadow-subtle transition-colors hover:border-[var(--color-border-hover)] focus-within:ring-2 focus-within:ring-[var(--color-interactive)] cursor-pointer ${isDragging ? "border-[var(--color-interactive)]/40 ring-1 ring-[var(--color-interactive)]/20" : "border-[var(--color-border)]"}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-interactive)] text-[11px] font-mono font-bold text-[#080809]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute inset-0 rounded-xl cursor-grab active:cursor-grabbing focus-visible:outline-none"
        aria-label={lang === "en" ? `Drag to reorder ${title}` : `Seret untuk ubah urutan ${title}`}
      />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--color-text-muted)]">
            <BlockIcon name={block.icon} size={12} />
          </span>
          <span className="truncate text-[12.5px] font-medium text-[var(--color-text-primary)]">{title}</span>
        </div>
        <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-[var(--color-text-secondary)]">{desc}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={lang === "en" ? `Remove ${title}` : `Hapus ${title}`}
        className="pointer-events-auto relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent bg-[var(--color-surface)] text-[var(--color-text-muted)] opacity-100 sm:opacity-60 transition-all hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)] hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] sm:group-hover:opacity-100 cursor-pointer touch-manipulation"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

function OverlayCard({ block, lang }: { block: ChapterBlock; lang: "en" | "id" }) {
  const title = lang === "en" ? block.titleEn : block.titleId;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-interactive)]/40 bg-[var(--color-surface-elevated)] px-3 py-2.5 shadow-floating rotate-[1deg]">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
        <BlockIcon name={block.icon} size={13} />
      </span>
      <span className="max-w-[200px] truncate text-[12px] font-medium text-[var(--color-text-primary)]">{title}</span>
    </div>
  );
}

export function CustomPrdBuilder({ language, selectedIds, onChangeSelectedIds }: { language: "en" | "id"; selectedIds: string[]; onChangeSelectedIds: (ids: string[]) => void }) {
  const t = useT(language);
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
    () => selectedIds.map((id) => getChapterBlock(id)).filter((b): b is ChapterBlock => Boolean(b)),
    [selectedIds],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const libraryGroups = useMemo(() => {
    const available = CHAPTER_BLOCKS.filter((b) => !selectedSet.has(b.id));
    return {
      product: available.filter((b) => b.category === "product"),
      technical: available.filter((b) => b.category === "technical"),
    };
  }, [selectedSet]);

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

  const removeBlock = useCallback((id: string) => {
    onChangeSelectedIds(selectedIds.filter((x) => x !== id));
  }, [selectedIds, onChangeSelectedIds]);

  const handleReset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    onChangeSelectedIds([]);
    setConfirmReset(false);
    if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
  }, [confirmReset, onChangeSelectedIds]);

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
            if (selectedIds.includes(a.blockId) || selectedIds.length >= MAX_CUSTOM_BLOCKS) return;
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

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 text-[11px] font-mono font-medium text-[var(--color-text-secondary)]">
            <Layers2 size={12} strokeWidth={1.5} />
            {counterText}
          </span>
          <span className="hidden text-[11px] text-[var(--color-text-muted)] sm:inline">
            {language === "en"
              ? isFull
                ? `Limit reached — remove a block to add more.`
                : `${MAX_CUSTOM_BLOCKS - selectedIds.length} slots left`
              : isFull
                ? `Batas tercapai — hapus blok untuk menambah lagi.`
                : `Sisa ${MAX_CUSTOM_BLOCKS - selectedIds.length} slot`}
          </span>
          <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-surface-highlight)] sm:block" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-[var(--color-interactive)] transition-all duration-300"
              style={{ width: `${(selectedIds.length / MAX_CUSTOM_BLOCKS) * 100}%` }}
            />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-text-muted)] sm:hidden">
            {isFull ? (language === "en" ? "Full" : "Penuh") : language === "en" ? `${MAX_CUSTOM_BLOCKS - selectedIds.length} left` : `Sisa ${MAX_CUSTOM_BLOCKS - selectedIds.length}`}
          </span>
          <button
            type="button"
            onClick={handleReset}
            disabled={selectedIds.length === 0}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none cursor-pointer ${
              confirmReset
                ? "border-[var(--color-error)] bg-[var(--color-error-bg)] text-[var(--color-error)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            <RotateCcw size={12} strokeWidth={1.5} />
            {confirmReset ? (language === "en" ? "Tap again to clear" : "Ketuk lagi untuk kosongkan") : t.builder.reset}
          </button>
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
          {/* Left: library */}
          <DroppablePanel
            id="panel-library"
            className={`rounded-2xl border bg-[var(--color-surface-elevated)] p-3 shadow-subtle transition-colors ${overId === "panel-library" ? "border-[var(--color-interactive)]/40" : "border-[var(--color-border)]"}`}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                <Library size={13} strokeWidth={1.5} />
              </span>
              <h3 className="text-[12px] font-semibold tracking-wide uppercase text-[var(--color-text-primary)]">
                {t.builder.libraryTitle}
              </h3>
              <span className="ml-auto text-[11px] font-mono text-[var(--color-text-muted)]">
                {libraryGroups.product.length + libraryGroups.technical.length} {language === "en" ? "available" : "tersedia"}
              </span>
            </div>

            <SortableContext
              id="library-sortable"
              items={CHAPTER_BLOCKS.filter((b) => !selectedSet.has(b.id)).map((b) => `lib-${b.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="h-px flex-1 bg-[var(--color-border)]" aria-hidden="true" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                      {t.builder.productGroup}
                    </span>
                    <span className="h-px flex-1 bg-[var(--color-border)]" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {libraryGroups.product.map((block) => (
                      <LibraryCard
                        key={block.id}
                        block={block}
                        lang={language}
                        disabled={isFull}
                        onAdd={() => addBlock(block.id)}
                        lastDragEndRef={lastDragEndRef}
                      />
                    ))}
                    {libraryGroups.product.length === 0 && (
                      <p className="col-span-full rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4 text-center text-[11px] text-[var(--color-text-muted)]">
                        {language === "en" ? "All Product blocks selected." : "Semua blok Produk sudah terpilih."}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="h-px flex-1 bg-[var(--color-border)]" aria-hidden="true" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                      {t.builder.technicalGroup}
                    </span>
                    <span className="h-px flex-1 bg-[var(--color-border)]" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {libraryGroups.technical.map((block) => (
                      <LibraryCard
                        key={block.id}
                        block={block}
                        lang={language}
                        disabled={isFull}
                        onAdd={() => addBlock(block.id)}
                        lastDragEndRef={lastDragEndRef}
                      />
                    ))}
                    {libraryGroups.technical.length === 0 && (
                      <p className="col-span-full rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4 text-center text-[11px] text-[var(--color-text-muted)]">
                        {language === "en" ? "All Technical blocks selected." : "Semua blok Teknis sudah terpilih."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </SortableContext>

            {isFull && (
              <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                {t.builder.limitHint}
              </p>
            )}
            <p className="mt-2 px-1 text-[11px] leading-snug text-[var(--color-text-muted)]">{t.builder.libraryHint}</p>
          </DroppablePanel>

          {/* Right: canvas selected */}
          <DroppablePanel
            id="panel-selected"
            className={`rounded-2xl border p-3 shadow-subtle transition-colors min-h-[320px] ${
              overId === "panel-selected" || Boolean(activeId?.startsWith("lib-") && overId?.startsWith("sel-"))
                ? "border-[var(--color-interactive)]/40 bg-[var(--color-surface)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
            }`}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-interactive)] text-[#080809]">
                <Layers2 size={13} strokeWidth={1.7} />
              </span>
              <h3 className="text-[12px] font-semibold tracking-wide uppercase text-[var(--color-text-primary)]">
                {t.builder.selectedTitle}
              </h3>
              <span className="ml-auto rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-mono text-[var(--color-text-secondary)]">
                {counterText}
              </span>
            </div>

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
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <SelectedCard block={block} index={idx} lang={language} onRemove={() => removeBlock(block.id)} lastDragEndRef={lastDragEndRef} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {selectedBlocks.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
                    <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
                      <Layers size={16} strokeWidth={1.5} />
                    </span>
                    <p className="max-w-[260px] text-[12.5px] font-medium text-[var(--color-text-primary)]">{t.builder.emptyTitle}</p>
                    <p className="mt-1 max-w-[260px] text-[11.5px] leading-snug text-[var(--color-text-secondary)]">{t.builder.emptyDesc}</p>
                  </div>
                )}

                {activeId?.startsWith("lib-") && selectedBlocks.length > 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--color-interactive)]/30 bg-[var(--color-interactive-subtle)] px-3 py-2 text-center text-[11px] text-[var(--color-text-muted)]">
                    {t.builder.dropHint}
                  </div>
                )}
              </div>
            </SortableContext>

            {selectedBlocks.length > 0 && (
              <p className="mt-3 px-1 text-[11px] leading-snug text-[var(--color-text-muted)]">{t.builder.canvasHint}</p>
            )}
          </DroppablePanel>
        </div>

        <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16,1,0.3,1)" }}>
          {activeBlock ? <OverlayCard block={activeBlock} lang={language} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
