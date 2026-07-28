import { describe, expect, test } from "vitest";
import {
  DEFAULT_TRANSITION,
  REDUCED_MOTION_TRANSITION,
  resolveTransitionStates,
} from "@kyomi/ui/atoms/transition";

const DIRECTIONAL_OFFSET = {
  forward: { enter: 28, exit: -16 },
  backward: { enter: -16, exit: 28 },
};

describe("Transition", () => {
  test.each([
    ["horizontal forward", "x" as const, "forward" as const, 28, -16],
    ["horizontal backward", "x" as const, "backward" as const, -16, 28],
    ["vertical forward", "y" as const, "forward" as const, 28, -16],
  ])("uses full transform strings for %s motion", (_, axis, direction, enter, exit) => {
    const states = resolveTransitionStates({
      axis,
      direction,
      offset: DIRECTIONAL_OFFSET,
      prefersReducedMotion: false,
    });
    const initialTransform =
      axis === "x" ? `translate3d(${enter}px, 0, 0)` : `translate3d(0, ${enter}px, 0)`;
    const exitTransform =
      axis === "x" ? `translate3d(${exit}px, 0, 0)` : `translate3d(0, ${exit}px, 0)`;
    const restingTransform = axis === "x" ? "translate3d(0px, 0, 0)" : "translate3d(0, 0px, 0)";

    expect(states.initial).toEqual({ opacity: 0, transform: initialTransform });
    expect(states.animate).toEqual({ opacity: 1, transform: restingTransform });
    expect(states.exit).toEqual({ opacity: 0, transform: exitTransform });
    expect(states.initial).not.toHaveProperty("x");
    expect(states.initial).not.toHaveProperty("y");
    expect(states.animate).not.toHaveProperty("x");
    expect(states.animate).not.toHaveProperty("y");
    expect(states.exit).not.toHaveProperty("x");
    expect(states.exit).not.toHaveProperty("y");
    expect(states.transition).toBe(DEFAULT_TRANSITION);
  });

  test("keeps reduced motion at rest while crossfading for 150ms", () => {
    const states = resolveTransitionStates({
      axis: "x",
      direction: "backward",
      offset: DIRECTIONAL_OFFSET,
      prefersReducedMotion: true,
    });

    expect(states.initial).toEqual({
      opacity: 0,
      transform: "translate3d(0px, 0, 0)",
    });
    expect(states.animate).toEqual({
      opacity: 1,
      transform: "translate3d(0px, 0, 0)",
    });
    expect(states.exit).toEqual({
      opacity: 0,
      transform: "translate3d(0px, 0, 0)",
    });
    expect(states.transition).toBe(REDUCED_MOTION_TRANSITION);
  });
});
