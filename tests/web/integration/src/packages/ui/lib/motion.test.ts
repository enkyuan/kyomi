import { describe, expect, test } from "vitest";
import { SPRING_DURATIONS, springTransition } from "@kyomi/ui/lib/motion";

describe("springTransition", () => {
  test("returns a bounce-free spring for each named duration", () => {
    expect(springTransition("quick")).toEqual({ type: "spring", duration: 0.24, bounce: 0 });
    expect(springTransition("standard")).toEqual({ type: "spring", duration: 0.28, bounce: 0 });
    expect(springTransition("emphasized")).toEqual({ type: "spring", duration: 0.3, bounce: 0 });
    expect(springTransition()).toEqual({
      type: "spring",
      duration: SPRING_DURATIONS.standard,
      bounce: 0,
    });
  });

  test("changes instantly when the user prefers reduced motion", () => {
    expect(springTransition("emphasized", true)).toEqual({ duration: 0 });
  });
});
