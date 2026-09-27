import { useState, useCallback } from "react";

export interface ScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

export const SCROLL_THRESHOLD = 500;

export function isFarFromTop(scrollTop: number, threshold = SCROLL_THRESHOLD): boolean {
  return scrollTop > threshold;
}

// ponytail: fixed 500px threshold for bottom distance; upgrade to container-ratio if dynamic viewports need it
export function isFarFromBottom(metrics: ScrollMetrics, threshold = SCROLL_THRESHOLD): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight > threshold;
}

interface ScrollState {
  showScrollTop: boolean;
  showScrollBottom: boolean;
}

export function useScroll(threshold = SCROLL_THRESHOLD) {
  const [state, setState] = useState<ScrollState>({
    showScrollTop: false,
    showScrollBottom: false,
  });

  const handleScroll = useCallback(
    (metrics: ScrollMetrics | number) => {
      const nextTop =
        typeof metrics === "number"
          ? isFarFromTop(metrics, threshold)
          : isFarFromTop(metrics.scrollTop, threshold);
      const nextBottom =
        typeof metrics === "number"
          ? false
          : isFarFromBottom(metrics, threshold);

      setState((prev) => {
        if (prev.showScrollTop === nextTop && prev.showScrollBottom === nextBottom) {
          return prev;
        }
        return { showScrollTop: nextTop, showScrollBottom: nextBottom };
      });
    },
    [threshold],
  );

  return {
    showScrollTop: state.showScrollTop,
    showScrollBottom: state.showScrollBottom,
    handleScroll,
  };
}

