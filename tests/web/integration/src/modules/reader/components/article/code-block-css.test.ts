import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../../..");

function readRepoFile(pathFromRepoRoot: string) {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

function ruleBody(css: string, selector: string) {
  const selectorIndex = css.indexOf(selector);
  expect(selectorIndex).toBeGreaterThanOrEqual(0);

  const bodyStart = css.indexOf("{", selectorIndex);
  expect(bodyStart).toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let index = bodyStart; index < css.length; index += 1) {
    const character = css[index];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(bodyStart + 1, index);
      }
    }
  }

  throw new Error(`Could not find rule body for ${selector}`);
}

describe("reader code block CSS", () => {
  const stylesheets = [
    readRepoFile("apps/web/src/styles.css"),
    readRepoFile("packages/reader/src/web/styles.css"),
  ];

  test("keeps enhanced code blocks column-width while inheriting normal wrapping", () => {
    for (const css of stylesheets) {
      const wrapper = ruleBody(css, ".reader-content .article-body [data-reader-code-block]");
      expect(wrapper).toContain("width: 100%;");
      expect(wrapper).toContain("min-width: 0;");
      expect(wrapper).toContain("max-width: 100%;");

      const pre = ruleBody(
        css,
        ".reader-content .article-body [data-reader-code-block] pre.reader-code-pre",
      );
      expect(pre).toContain("overflow-x: auto;");
      expect(pre).toContain("white-space: pre-wrap;");
      expect(pre).toContain("overflow-wrap: normal;");

      const code = ruleBody(
        css,
        ".reader-content .article-body [data-reader-code-block] pre.reader-code-pre code.hljs",
      );
      expect(code).toContain("white-space: inherit;");
      expect(code).toContain("overflow-wrap: normal;");
    }
  });
});
