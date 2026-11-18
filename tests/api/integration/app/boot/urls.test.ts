import { describe, expect, test } from "bun:test";
import { parseUrlRepairArgs } from "../../../../../apps/api/src/app/boot/urls";

describe("parseUrlRepairArgs", () => {
  test("is a dry run by default, with batch 100 and a 100ms pause", () => {
    expect(parseUrlRepairArgs(["bun", "urls.ts"])).toEqual({
      apply: false,
      batchSize: 100,
      sleepMs: 100,
    });
  });

  test("writes only with an explicit --apply", () => {
    expect(parseUrlRepairArgs(["bun", "urls.ts", "--apply"]).apply).toBe(true);
    // Near misses and the dry-run spelling never write.
    for (const flag of ["--aply", "--apply=true", "apply", "--dry-run", "-a"]) {
      expect(parseUrlRepairArgs(["bun", "urls.ts", flag]).apply).toBe(false);
    }
  });

  test("parses --batch-size and --sleep-ms", () => {
    expect(
      parseUrlRepairArgs(["bun", "urls.ts", "--apply", "--batch-size", "250", "--sleep-ms", "500"]),
    ).toEqual({ apply: true, batchSize: 250, sleepMs: 500 });
  });

  test("rejects a batch size outside 1..500 and malformed numbers", () => {
    for (const value of ["0", "501", "-1", "abc"]) {
      expect(() => parseUrlRepairArgs(["bun", "urls.ts", "--batch-size", value])).toThrow();
    }
    for (const value of ["0", "-1", "abc"]) {
      expect(() => parseUrlRepairArgs(["bun", "urls.ts", "--sleep-ms", value])).toThrow();
    }
    expect(parseUrlRepairArgs(["bun", "urls.ts", "--batch-size", "500"]).batchSize).toBe(500);
  });
});
