export {
  AnimatePresence,
  LazyMotion,
  animate,
  domAnimation,
  domMax,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

export type { MotionValue } from "motion/react";

/**
 * Spring durations (seconds) shared by Kyomi's Motion surfaces. Bounce is always 0: UI springs
 * settle without overshoot.
 * - `quick`: small value changes such as tickers.
 * - `standard`: control swaps, panels, and list scope changes.
 * - `emphasized`: content reels and action reveals that carry more weight.
 */
export const SPRING_DURATIONS = {
  quick: 0.24,
  standard: 0.28,
  emphasized: 0.3,
} as const;

export type SpringKind = keyof typeof SPRING_DURATIONS;

export type SpringTransition =
  | { type: "spring"; duration: number; bounce: 0 }
  | { duration: 0; type?: undefined; bounce?: undefined };

/** A bounce-free spring, or an instant change when the user prefers reduced motion. */
export function springTransition(
  kind: SpringKind = "standard",
  prefersReducedMotion: boolean | null = false,
): SpringTransition {
  return prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", duration: SPRING_DURATIONS[kind], bounce: 0 };
}

/** Mirrors `--ease-out-quint` in `styles/theme.css` for Motion and WAAPI. */
export const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const;

/**
 * Enter and exit states for a control swapped in or out of a toolbar or header (filter tabs, back
 * and reader controls, step navigation). One recipe everywhere: a slight scale and blur, never from
 * zero, so the same swap reads the same in the feed and the article.
 */
export const CONTROL_SWAP_HIDDEN = { opacity: 0, scale: 0.96, filter: "blur(4px)" } as const;
export const CONTROL_SWAP_SHOWN = { opacity: 1, scale: 1, filter: "blur(0px)" } as const;

/** `initial`/`animate`/`exit` for a swapped control; no movement under reduced motion. */
export function controlSwapMotion(prefersReducedMotion: boolean | null = false) {
  return {
    initial: prefersReducedMotion ? (false as const) : CONTROL_SWAP_HIDDEN,
    animate: CONTROL_SWAP_SHOWN,
    exit: prefersReducedMotion ? undefined : CONTROL_SWAP_HIDDEN,
  };
}
