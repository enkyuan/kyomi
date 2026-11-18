import { describe, expect, test } from "bun:test";
import { compileArticleDocument } from "@kyomi/ingest/document";
import {
  languageFromContent,
  languageFromFilename,
  lookupLanguage,
  resolveLanguage,
} from "../../../../../../../../packages/ingest/src/document/code-language";

/**
 * Language hints, file names, shebangs and class names are publisher text. Names such as
 * `constructor` and `__proto__` are keys of every plain object, so a lookup table that reads them
 * without checking they are its own answers with a function and the next call throws on it.
 */

const BASE = "https://example.com/posts/entry";
const PROTOTYPE_KEYS = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];

describe("language lookups ignore the keys every object has", () => {
  test.each(PROTOTYPE_KEYS)("%s as a file name, extension, interpreter or hint", (key) => {
    expect(languageFromFilename(key)).toBeNull();
    expect(languageFromFilename(`file.${key}`)).toBeNull();
    expect(languageFromFilename(`dir/${key}`)).toBeNull();
    expect(languageFromContent(`#!/bin/${key}\necho hi`)).toBeNull();
    expect(languageFromContent(`#!/usr/bin/env ${key}\necho hi`)).toBeNull();
    expect(lookupLanguage(key)).toBeNull();
    expect(resolveLanguage(`language-${key}`, `x.${key}`, `#!/bin/${key}\n`).language).toBeNull();
  });

  test("real names still resolve through the same tables", () => {
    expect(languageFromFilename("app.mjs")?.id).toBe("javascript");
    expect(languageFromFilename("Dockerfile")?.id).toBe("docker");
    expect(languageFromFilename("setup.ps1")?.id).toBe("powershell");
    expect(languageFromFilename("main.ts")?.id).toBe("typescript");
    expect(languageFromContent("#!/usr/bin/env node\nconsole.log(1)")?.id).toBe("javascript");
    expect(languageFromContent("#!/bin/zsh\necho 1")?.id).toBe("shellscript");
    expect(resolveLanguage("language-ts", undefined, "").language?.id).toBe("typescript");
  });
});

describe("a hostile hint does not cost the article its document", () => {
  const compile = (body: string) =>
    compileArticleDocument({ body, origin: "feed_html", baseUrl: BASE });

  test.each(PROTOTYPE_KEYS)("a shebang naming %s", async (key) => {
    const { document, diagnostics } = await compile(
      `<pre><code>#!/bin/${key}\necho hi</code></pre>`,
    );

    expect(diagnostics.warnings.filter((warning) => warning.startsWith("compile-failed"))).toEqual(
      [],
    );
    expect(document).not.toBeNull();
  });

  test.each(PROTOTYPE_KEYS)("a class or file name using %s", async (key) => {
    const { document, diagnostics } = await compile(
      `<div class="code-block-title">a.${key}</div><pre><code class="language-${key}">x = 1\ny = 2</code></pre>`,
    );

    expect(diagnostics.warnings).toEqual([]);
    expect(document).not.toBeNull();
  });

  test("a callout class that is a key of every object is still a note", async () => {
    for (const key of PROTOTYPE_KEYS) {
      const { document } = await compile(`<div class="alert ${key}"><p>text here</p></div>`);
      const [block] = (document?.blocks ?? []) as { type: string; variant?: string }[];

      expect(block?.type).toBe("callout");
      expect(block?.variant).toBe("note");
    }
  });

  test("a callout class that names a variant still picks it", async () => {
    const { document } = await compile('<div class="alert alert-warning"><p>text here</p></div>');
    const [block] = (document?.blocks ?? []) as { type: string; variant?: string }[];

    expect(block?.variant).toBe("warning");
  });
});
