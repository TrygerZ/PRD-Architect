import { useState, useCallback } from "react";

export function useScroll() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback((scrollTop: number) => {
    setShowScrollTop(scrollTop > 500);
  }, []);

  return { showScrollTop, handleScroll };
}
