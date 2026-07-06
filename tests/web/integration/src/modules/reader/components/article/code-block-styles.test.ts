import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../../..");

function readStylesheet(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

function declarationBlock(styles: string, selector: string): string {
  const index = styles.indexOf(selector);
  expect(index, `Missing selector ${selector}`).toBeGreaterThanOrEqual(0);

  const openBrace = styles.indexOf("{", index);
  const closeBrace = styles.indexOf("}", openBrace);
  expect(openBrace, `Missing opening brace for ${selector}`).toBeGreaterThanOrEqual(0);
  expect(closeBrace, `Missing closing brace for ${selector}`).toBeGreaterThan(openBrace);

  return styles.slice(openBrace + 1, closeBrace);
}

function expectDeclaration(block: string, property: string, value: string): void {
  expect(block).toContain(`${property}: ${value};`);
}

describe("reader code block styles", () => {
  test("wrap enhanced code without letting content resize the block", () => {
    const stylesheets = [
      readStylesheet("packages/ui/src/styles/reader.css"),
      readStylesheet("packages/reader/src/web/styles.css"),
    ];

    for (const styles of stylesheets) {
      const wrapper = declarationBlock(
        styles,
        ".reader-content .article-body [data-reader-code-block]",
      );
      expectDeclaration(wrapper, "width", "100%");
      expectDeclaration(wrapper, "max-width", "100%");
      expectDeclaration(wrapper, "min-width", "0");

      const pre = declarationBlock(
        styles,
        ".reader-content .article-body [data-reader-code-block] pre.reader-code-pre",
      );
      expectDeclaration(pre, "max-width", "100%");
      expectDeclaration(pre, "min-width", "0");
      expectDeclaration(pre, "overflow-x", "auto");
      expectDeclaration(pre, "white-space", "pre-wrap");

      const code = declarationBlock(
        styles,
        ".reader-content .article-body [data-reader-code-block] pre.reader-code-pre code.hljs",
      );
      expectDeclaration(code, "max-width", "100%");
      expectDeclaration(code, "min-width", "0");
      expectDeclaration(code, "white-space", "inherit");
      expectDeclaration(code, "overflow-wrap", "normal");
    }
  });
});
