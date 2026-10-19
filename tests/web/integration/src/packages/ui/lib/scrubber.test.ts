// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import {
  createScrubberMotion,
  paintScrubber,
  rubberBand,
  slotCount,
  type ScrubberLayout,
} from "@kyomi/ui/lib/scrubber";

describe("rubberBand", () => {
  test("resists harder the further it is pulled and never passes the limit", () => {
    const near = rubberBand(10);
    const far = rubberBand(200);

    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(10);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThan(24);
    expect(rubberBand(-10)).toBeCloseTo(-near);
    expect(rubberBand(0)).toBe(0);
  });
});

describe("slotCount", () => {
  test("keeps one tick per item while they fit, then buckets dense lists", () => {
    expect(slotCount(12, 0)).toBe(12);
    expect(slotCount(12, 99)).toBe(12);
    expect(slotCount(129, 300)).toBe(51);
    expect(slotCount(1, 300)).toBe(1);
    expect(slotCount(0, 300)).toBe(0);
  });
});

describe("paintScrubber", () => {
  const layout: ScrubberLayout = {
    width: 90,
    slots: 10,
    last: 9,
    value: 2,
    range: [1.5, 4.5],
    separators: [5],
  };

  function elements() {
    return {
      ticks: Array.from({ length: 10 }, () => document.createElement("span")),
      separators: [document.createElement("span")],
      field: document.createElement("div"),
      label: document.createElement("div"),
    };
  }

  test("marks the current item and darkens ticks inside the visible range", () => {
    const motion = createScrubberMotion();
    const nodes = elements();

    paintScrubber(motion, layout, nodes, false, 16);

    expect(nodes.ticks[2]?.hasAttribute("data-current")).toBe(true);
    expect(Number(nodes.ticks[3]?.style.opacity)).toBe(1);
    expect(Number(nodes.ticks[8]?.style.opacity)).toBeLessThan(0.2);
  });

  test("magnifies and highlights the tick under the pointer, then settles", () => {
    const motion = createScrubberMotion();
    motion.pointerX = 60;
    motion.targetPop = 1;
    const nodes = elements();

    const settling = paintScrubber(motion, layout, nodes, true, 16);

    expect(settling).toBe(false);
    expect(nodes.ticks[6]?.hasAttribute("data-preview")).toBe(true);
    expect(nodes.ticks[6]?.style.transform).toContain("scale(1.340,");
    expect(nodes.label.style.translate).toBe("calc(60.00px - 50%) 0");
  });

  test("keeps animating while the springs are still moving", () => {
    const motion = createScrubberMotion();
    motion.pointerX = 30;
    motion.targetPop = 1;

    expect(paintScrubber(motion, layout, elements(), false, 16)).toBe(true);
    expect(motion.pop).toBeGreaterThan(0);
    expect(motion.pop).toBeLessThan(1);
  });
});
