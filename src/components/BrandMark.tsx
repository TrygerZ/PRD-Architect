import type { JSX } from "react";

export interface BrandMarkProps {
  size?: 24 | 28 | 36;
  className?: string;
}

const RADIUS_BY_SIZE: Record<24 | 28 | 36, string> = {
  24: "rounded-[6px]",
  28: "rounded-[7px]",
  36: "rounded-[9px]",
};

/**
 * Solid architectural "P" monogram with Satin Champagne keystone bar.
 */
export function BrandMark({ size = 28, className }: BrandMarkProps): JSX.Element {
  const radiusClass = RADIUS_BY_SIZE[size];
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center select-none bg-[var(--oa-bg-elevated)] border border-[var(--oa-border-default)] shadow-subtle ${radiusClass}${className ? ` ${className}` : ""}`}
    >
      <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true">
        <path
          d="M6.5 5H13a4.5 4.5 0 0 1 0 9H9.5v5h-3V5zm3 2.75v3.5H13a1.75 1.75 0 0 0 0-3.5H9.5z"
          fill="var(--oa-text-primary)"
        />
        <rect
          x="12"
          y="16"
          width="5.5"
          height="3"
          rx="0.75"
          fill="var(--oa-accent-champagne)"
        />
      </svg>
    </span>
  );
}
