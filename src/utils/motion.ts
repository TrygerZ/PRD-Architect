import type { Transition } from "motion/react";

export const SPRING_SLIDE: Transition = {
  type: "spring",
  mass: 1,
  stiffness: 260,
  damping: 28,
};

export const EXPO_MORPH: Transition = {
  duration: 0.42,
  ease: [0.16, 1, 0.3, 1],
};

export const MODAL_SLIDE_UP: Transition = {
  duration: 0.28,
  ease: [0.16, 1, 0.3, 1],
};

export const POPOVER_FADE: Transition = {
  duration: 0.16,
  ease: "easeOut",
};
