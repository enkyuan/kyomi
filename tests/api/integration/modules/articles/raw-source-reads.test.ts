import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const apiSrc = join(import.meta.dir, "../../../../../apps/api/src");
const RAW_TABLES = ["articleClips", "feedItems", "articleExtractionCache"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Tables with raw source columns must be read with an explicit projection: a whole-row
 * `.select()` would fetch and decompress raw article bodies the caller never uses.
 */
describe("raw source reads", () => {
  test("no API query selects whole rows from tables that hold raw article bodies", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(apiSrc)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\.select\(\)\s*\.from\((\w+)\)/g)) {
        if (RAW_TABLES.includes(match[1]!)) {
          offenders.push(`${file.slice(apiSrc.length + 1)}: ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
