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
