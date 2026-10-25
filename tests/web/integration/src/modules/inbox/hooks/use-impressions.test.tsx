// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetReportedImpressions, useImpressions } from "@modules/inbox/hooks/use-impressions";

type ObserverEntry = Pick<
  IntersectionObserverEntry,
  "target" | "isIntersecting" | "intersectionRatio"
>;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed = new Set<Element>();
  disconnected = false;

  constructor(private callback: (entries: ObserverEntry[]) => void) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }

  report(id: string, ratio: number) {
    const target = [...this.observed].find((el) => el.getAttribute("data-impression-id") === id);
    if (!target) {
      throw new Error(`row ${id} is not observed`);
    }
    this.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  }
}

function Rows({ ids, onReport }: { ids: string[]; onReport: (ids: string[]) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useImpressions({ containerRef: ref, watchKey: ids.join(","), onReport });
  return (
    <div ref={ref}>
      {ids.map((id) => (
        <div key={id} data-impression-id={id} />
      ))}
    </div>
  );
}

function observer() {
  const current = FakeIntersectionObserver.instances
    .filter((instance) => !instance.disconnected)
    .at(-1);
  if (!current) {
    throw new Error("no active observer");
  }
  return current;
}

describe("useImpressions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeIntersectionObserver.instances = [];
    resetReportedImpressions();
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("reports a row that stays at least half visible for a second", async () => {
    const onReport = vi.fn();
    render(<Rows ids={["a"]} onReport={onReport} />);

    observer().report("a", 0.5);
    await vi.advanceTimersByTimeAsync(999);
    expect(onReport).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1 + 500);
    expect(onReport).toHaveBeenCalledExactlyOnceWith(["a"]);
  });

  test("does not report a row that is less than half visible", async () => {
    const onReport = vi.fn();
    render(<Rows ids={["a"]} onReport={onReport} />);

    observer().report("a", 0.49);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onReport).not.toHaveBeenCalled();
  });

  test("does not report a row that scrolls away before the second is up", async () => {
    const onReport = vi.fn();
    render(<Rows ids={["a"]} onReport={onReport} />);

    observer().report("a", 1);
    await vi.advanceTimersByTimeAsync(600);
    observer().report("a", 0.2);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onReport).not.toHaveBeenCalled();
  });

  test("restarts the second when a row returns to view", async () => {
    const onReport = vi.fn();
    render(<Rows ids={["a"]} onReport={onReport} />);

    observer().report("a", 1);
    await vi.advanceTimersByTimeAsync(600);
    observer().report("a", 0);
    observer().report("a", 1);
    await vi.advanceTimersByTimeAsync(600);
    expect(onReport).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400 + 500);
    expect(onReport).toHaveBeenCalledExactlyOnceWith(["a"]);
  });

  test("batches rows that qualify close together into one report", async () => {
    const onReport = vi.fn();
    render(<Rows ids={["a", "b"]} onReport={onReport} />);

    observer().report("a", 1);
    await vi.advanceTimersByTimeAsync(200);
    observer().report("b", 0.8);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onReport).toHaveBeenCalledExactlyOnceWith(["a", "b"]);
  });

  test("reports each row once per page view, even across remounts", async () => {
    const onReport = vi.fn();
    const first = render(<Rows ids={["a"]} onReport={onReport} />);
    observer().report("a", 1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onReport).toHaveBeenCalledTimes(1);

    first.unmount();
    render(<Rows ids={["a"]} onReport={onReport} />);
    observer().report("a", 1);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onReport).toHaveBeenCalledTimes(1);
  });

  test("sends impressions that are waiting to be batched when the rows unmount", async () => {
    const onReport = vi.fn();
    const view = render(<Rows ids={["a"]} onReport={onReport} />);

    observer().report("a", 1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onReport).not.toHaveBeenCalled();
    view.unmount();

    expect(onReport).toHaveBeenCalledExactlyOnceWith(["a"]);
  });

  test("never sends more than twenty ids in one request", async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `row-${index}`);
    const onReport = vi.fn();
    render(<Rows ids={ids} onReport={onReport} />);

    for (const id of ids) {
      observer().report(id, 1);
    }
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onReport.mock.calls.map(([batch]) => batch.length)).toEqual([20, 5]);
  });

  test("observes rows added later", async () => {
    const onReport = vi.fn();
    const view = render(<Rows ids={["a"]} onReport={onReport} />);
    view.rerender(<Rows ids={["a", "b"]} onReport={onReport} />);

    observer().report("b", 1);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onReport).toHaveBeenCalledExactlyOnceWith(["b"]);
  });
});
