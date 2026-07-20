import { describe, expect, test } from "vitest";
import {
  getRecapScreenKey,
  RECAP_NAVIGATION_TRANSITION,
  RECAP_TRANSITION_OFFSET,
} from "@modules/inbox/components/recap/screen-key";

const RECAP_SECTIONS = ["folders", "topSources", "worthRevisiting"] as const;

describe("recap screen navigation", () => {
  test("uses stable navigation-only screen keys", () => {
    expect(getRecapScreenKey({ expandedSection: null })).toBe("recap-summary");

    for (const section of RECAP_SECTIONS) {
      expect(getRecapScreenKey({ expandedSection: section })).toBe(`recap-expanded-${section}`);
    }
  });

  test("uses asymmetric directional offsets", () => {
    expect(RECAP_TRANSITION_OFFSET).toEqual({
      forward: { enter: 28, exit: -16 },
      backward: { enter: -16, exit: 28 },
    });
  });

  test("returns faster than it drills in with the shared ease-out tween", () => {
    expect(RECAP_NAVIGATION_TRANSITION.forward).toEqual({
      type: "tween",
      duration: 0.22,
      ease: [0.23, 1, 0.32, 1],
    });
    expect(RECAP_NAVIGATION_TRANSITION.backward).toEqual({
      type: "tween",
      duration: 0.18,
      ease: [0.23, 1, 0.32, 1],
    });
  });
});
