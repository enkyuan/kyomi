// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { mark, readMarks } from "@lib/perf/marks";

describe("marks", () => {
  afterEach(() => {
    performance.clearMarks();
    vi.restoreAllMocks();
  });

  test("records a mark under the kyomi: namespace and reads it back by its short name", () => {
    mark("hydrate-start");

    expect(performance.getEntriesByName("kyomi:hydrate-start")).toHaveLength(1);
    expect(readMarks()).toHaveProperty("hydrate-start");
  });

  test("ignores marks that are not its own and keeps the first time a name was recorded", () => {
    performance.mark("someone-else");
    mark("route-resolved");
    const first = readMarks()["route-resolved"];
    mark("route-resolved");

    expect(readMarks()).not.toHaveProperty("someone-else");
    expect(readMarks()["route-resolved"]).toBe(first);
  });

  test("does not throw when User Timing fails", () => {
    vi.spyOn(performance, "mark").mockImplementation(() => {
      throw new Error("unavailable");
    });

    expect(() => mark("anything")).not.toThrow();
  });
});
