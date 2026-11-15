import { describe, expect, test } from "bun:test";
import { tableColumnWidths } from "../../../../../packages/reader/src/native/document/table-layout";

const options = { available: 348, charWidth: 7 };

describe("tableColumnWidths", () => {
  test("a narrow table fills the container and gives the long column the room", () => {
    const widths = tableColumnWidths(
      [
        [
          { chars: 4, span: 1 },
          { chars: 7, span: 1 },
        ],
        [
          { chars: 5, span: 1 },
          { chars: 48, span: 1 },
        ],
      ],
      options,
    );
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(options.available);
    expect(widths[1]).toBeGreaterThan(widths[0] ?? 0);
  });

  test("a table wider than the container keeps natural widths and scrolls", () => {
    const row = Array.from({ length: 6 }, () => ({ chars: 40, span: 1 }));
    const widths = tableColumnWidths([row], options);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeGreaterThan(options.available);
    expect(Math.max(...widths)).toBeLessThanOrEqual(240);
  });

  test("an empty table has no columns", () => {
    expect(tableColumnWidths([], options)).toEqual([]);
  });
});
