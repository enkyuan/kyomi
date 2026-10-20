import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../..");
const readStyle = (name: string) =>
  readFileSync(resolve(repoRoot, "packages/ui/src/styles", name), "utf8");

describe("scrollbar styles", () => {
  const scrollbar = readStyle("scrollbar.css");
  const theme = readStyle("theme.css");

  test("every scrollbar token the stylesheet reads is defined for light and dark", () => {
    const declaredHere = new Set(
      [...scrollbar.matchAll(/(--scrollbar-[a-z-]+):/g)].map((match) => match[1] as string),
    );
    const tokens = new Set(
      [...scrollbar.matchAll(/var\((--scrollbar-[a-z-]+)\)/g)]
        .map((match) => match[1] as string)
        .filter((token) => !declaredHere.has(token)),
    );
    const darkStart = theme.indexOf("\n.dark {");

    expect(tokens.size).toBeGreaterThan(0);
    for (const token of tokens) {
      const definition = new RegExp(`${token}:`);
      expect(theme.slice(0, darkStart)).toMatch(definition);
      expect(theme.slice(darkStart)).toMatch(definition);
    }
  });

  test("the ScrollArea gutter reads only scrollbar tokens the stylesheets declare", () => {
    const area = readFileSync(
      resolve(repoRoot, "packages/ui/src/components/scroll-area.tsx"),
      "utf8",
    );
    const tokens = [...area.matchAll(/\((--scrollbar-[a-z-]+)\)/g)].map(
      (match) => match[1] as string,
    );

    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(scrollbar + theme).toContain(`${token}:`);
    }
  });
});
