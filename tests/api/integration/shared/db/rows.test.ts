import { describe, expect, test } from "bun:test";
import { rowsFromExecute } from "@shared/db/rows";

describe("rowsFromExecute", () => {
  test("reads both result shapes of db.execute", () => {
    expect(rowsFromExecute<{ id: number }>([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
    expect(rowsFromExecute<{ id: number }>({ rows: [{ id: 3 }], rowCount: 1 })).toEqual([
      { id: 3 },
    ]);
  });

  test("returns no rows for anything else", () => {
    expect(rowsFromExecute(undefined)).toEqual([]);
    expect(rowsFromExecute(null)).toEqual([]);
    expect(rowsFromExecute({ rowCount: 0 })).toEqual([]);
    expect(rowsFromExecute("rows")).toEqual([]);
  });
});
