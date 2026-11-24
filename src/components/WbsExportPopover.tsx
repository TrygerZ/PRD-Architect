import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { PRDMode } from "../../shared/types";
import type { ThemeMode } from "../utils/theme";
import {
  buildWbsSvg,
  computeRasterDimensions,
  exportWbsImage,
  type WbsExportFormat,
  type WbsExportScale,
  type WbsExportTheme,
} from "../utils/exportWbsImage";
import { POPOVER_FADE } from "../utils/motion";
import { useT } from "../hooks/useT";

export interface WbsExportPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  language: "id" | "en";
  uiTheme: ThemeMode;
  content: string;
  productType: string;
  prdMode?: PRDMode;
  versionLabel?: string;
  collapsedIds: ReadonlySet<string>;
  nodeHeights: Record<string, number>;
  onNotify?: (message: string) => void;
}

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-[var(--oa-accent-champagne)] focus-visible:outline-none";

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11.5px] font-medium text-[var(--oa-text-primary)] leading-tight">
          {label}
        </div>
        <div className="text-[10px] text-[var(--oa-text-muted)] leading-tight mt-0.5">
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-[34px] h-[20px] rounded-full border transition-colors cursor-pointer ${FOCUS_RING} ${
          checked
            ? "bg-[var(--oa-accent-champagne)] border-[var(--oa-border-champagne)]"
            : "oa-recessed-well border-[var(--oa-border-default)]"
        }`}
      >
        <span
          className={`block w-[14px] h-[14px] rounded-full transition-transform ${
            checked
              ? "translate-x-[15px] bg-[var(--oa-text-on-cta)]"
              : "translate-x-[2px] bg-[var(--oa-text-muted)]"
          }`}
        />
      </button>
    </div>
  );
}

export function WbsExportPopover({
  isOpen,
  onClose,
  language,
  uiTheme,
  content,
  productType,
  prdMode,
  versionLabel,
  collapsedIds,
  nodeHeights,
  onNotify,
}: WbsExportPopoverProps) {
  const t = useT(language);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [format, setFormat] = useState<WbsExportFormat>("png");
  const [scale, setScale] = useState<WbsExportScale>(3);
  const [exportTheme, setExportTheme] = useState<WbsExportTheme>(
    uiTheme === "dark" ? "obsidian" : "titanium",
  );
  const [expandAll, setExpandAll] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Sync default canvas theme to active UI theme when opening
  useEffect(() => {
    if (isOpen) {
      setExportTheme(uiTheme === "dark" ? "obsidian" : "titanium");
    }
  }, [isOpen, uiTheme]);

  // Dismiss on Escape or outside click
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-wbs-export-trigger="true"]')) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const estimate = useMemo(() => {
    if (!isOpen) return null;
    const preview = buildWbsSvg(
      content,
      productType,
      language,
      {
        format,
        scale,
        theme: exportTheme,
        expandAll,
        includeHeader,
        collapsedIds,
        nodeHeights,
        versionLabel,
      },
      prdMode,
    );
    if (!preview) return null;
    if (format === "svg") {
      return {
        width: preview.width,
        height: preview.height,
        nodeCount: preview.nodeCount,
        clamped: false,
      };
    }
    const dims = computeRasterDimensions(preview.width, preview.height, scale);
    return {
      width: dims.width,
      height: dims.height,
      nodeCount: preview.nodeCount,
      clamped: dims.clamped,
    };
  }, [
    isOpen,
    content,
    productType,
    language,
    format,
    scale,
    exportTheme,
    expandAll,
    includeHeader,
    collapsedIds,
    nodeHeights,
    versionLabel,
    prdMode,
  ]);

  const themeOptions: Array<{ id: WbsExportTheme; label: string; swatchStyle: string }> = [
    { id: "obsidian", label: t.wbs.themeObsidian, swatchStyle: "bg-[#08090C]" },
    { id: "titanium", label: t.wbs.themeTitanium, swatchStyle: "bg-[#E2E4E9]" },
    { id: "print", label: t.wbs.themePrint, swatchStyle: "bg-[#FFFFFF]" },
    {
      id: "transparent",
      label: t.wbs.themeTransparent,
      swatchStyle:
        "bg-[repeating-conic-gradient(#8b92a0_0%_25%,transparent_0%_50%)] bg-[length:6px_6px]",
    },
  ];

  const handleDownload = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await exportWbsImage(
        content,
        productType,
        language,
        {
          format,
          scale,
          theme: exportTheme,
          expandAll,
          includeHeader,
          collapsedIds,
          nodeHeights,
          versionLabel,
        },
        prdMode,
      );
      if (!res.ok) {
        onNotify?.(res.reason === "empty" ? t.wbs.exportEmpty : t.wbs.exportFailed);
        return;
      }
      if (res.clamped) {
        onNotify?.(
          t.wbs.exportClampedNote
            .replace("{filename}", res.filename)
            .replace("{w}", String(res.width))
            .replace("{h}", String(res.height)),
        );
      } else {
        onNotify?.(t.wbs.exportSuccess.replace("{filename}", res.filename));
      }
      onClose();
    } catch (err) {
      console.error("WBS image export failed:", err);
      onNotify?.(t.wbs.exportFailed);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          role="dialog"
          aria-label={t.wbs.exportTitle}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={POPOVER_FADE}
          className="absolute bottom-16 left-4 z-20 w-[324px] max-w-[calc(100vw-2rem)] oa-elev-popover rounded-2xl border border-[var(--oa-border-champagne)]/75 p-3.5 space-y-3 select-none pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon
                size={14}
                strokeWidth={1.6}
                className="text-[var(--oa-accent-champagne)] shrink-0"
                aria-hidden="true"
              />
              <span className="text-[12.5px] font-semibold text-[var(--oa-text-primary)] truncate">
                {t.wbs.exportTitle}
              </span>
            </div>
            <span className="shrink-0 rounded-md border border-[var(--oa-border-champagne)] bg-[var(--oa-accent-champagne-tint)] px-1.5 py-0.5 text-[9.5px] font-mono font-bold tracking-[0.04em] text-[var(--oa-text-champagne)]">
              {t.wbs.exportVectorBadge}
            </span>
          </div>

          {/* Format & Resolution */}
          <div className="space-y-1.5">
            <span className="block text-[9.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
              {t.wbs.exportFormatScale}
            </span>
            <div className="oa-recessed-well grid grid-cols-2 gap-1 p-1 rounded-xl">
              {(["png", "svg"] as const).map((fmt) => {
                const active = format === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${FOCUS_RING} ${
                      active
                        ? "bg-[var(--oa-bg-elevated)] border border-[var(--oa-border-champagne)] text-[var(--oa-text-champagne)] font-bold"
                        : "border border-transparent text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] font-medium"
                    }`}
                  >
                    {fmt === "png" ? t.wbs.exportPng : t.wbs.exportSvg}
                  </button>
                );
              })}
            </div>

            {format === "png" && (
              <div className="oa-recessed-well grid grid-cols-2 gap-1 p-1 rounded-xl">
                {([2, 3] as const).map((sc) => {
                  const active = scale === sc;
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setScale(sc)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${FOCUS_RING} ${
                        active
                          ? "bg-[var(--oa-bg-elevated)] border border-[var(--oa-border-champagne)] text-[var(--oa-text-champagne)] font-bold"
                          : "border border-transparent text-[var(--oa-text-secondary)] hover:text-[var(--oa-text-primary)] font-medium"
                      }`}
                    >
                      {sc === 2 ? t.wbs.exportScale2x : t.wbs.exportScale3x}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Canvas Theme */}
          <div className="space-y-1.5">
            <span className="block text-[9.5px] font-mono uppercase tracking-[0.06em] text-[var(--oa-text-muted)]">
              {t.wbs.exportTheme}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {themeOptions.map((opt) => {
                const active = exportTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExportTheme(opt.id)}
                    className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer ${FOCUS_RING} ${
                      active
                        ? "bg-[var(--oa-accent-champagne-tint)] border-[var(--oa-border-champagne)] text-[var(--oa-text-champagne)] font-semibold"
                        : "oa-recessed-well text-[var(--oa-text-secondary)] hover:border-[var(--oa-border-default)] font-medium"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-[3px] border border-[var(--oa-border-default)] shrink-0 ${opt.swatchStyle}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2.5 pt-0.5">
            <ToggleSwitch
              checked={expandAll}
              onChange={setExpandAll}
              label={t.wbs.expandAllOption}
              description={t.wbs.expandAllDesc}
            />
            <ToggleSwitch
              checked={includeHeader}
              onChange={setIncludeHeader}
              label={t.wbs.headerLegendOption}
              description={t.wbs.headerLegendDesc}
            />
          </div>

          {/* Output Estimate */}
          {estimate && (
            <div className="oa-recessed-well flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-mono">
              <span className="text-[var(--oa-text-secondary)] truncate">
                {estimate.width} x {estimate.height} px ·{" "}
                {format === "png" ? `${scale}x PNG` : "SVG"}
              </span>
              <span className="text-[var(--oa-text-muted)] shrink-0">
                {estimate.nodeCount} {language === "en" ? "nodes" : "node"}
              </span>
            </div>
          )}

          {/* Primary Download CTA */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || !estimate}
            className={`oa-bevel-cta w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
          >
            {isExporting ? (
              <>
                <Loader2 size={13} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                <span>{t.wbs.exporting}</span>
              </>
            ) : (
              <>
                <Download size={13} strokeWidth={1.75} aria-hidden="true" />
                <span>
                  {format === "png"
                    ? t.wbs.downloadPngCta.replace("{scale}", String(scale))
                    : t.wbs.downloadSvgCta}
                </span>
              </>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
