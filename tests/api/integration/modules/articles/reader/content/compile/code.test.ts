import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

const run = (html: string) => runThrough(html, "code");
const codeOf = async (html: string) => {
  const draft = await run(html);
  const block = draft.blocks[0];
  if (block?.type !== "code") {
    throw new Error("expected a code block");
  }
  return block;
};

describe("code (pass 13)", () => {
  test("resolves an explicit hint to the canonical id and label", async () => {
    const block = await codeOf(`<pre class="language-ts"><code>const a: number = 1;</code></pre>`);
    expect(block).toMatchObject({
      language: "typescript",
      languageSource: "explicit",
      label: "TypeScript",
    });
  });

  test.each([
    ["Bash", "shellscript"],
    ["py", "python"],
    ["js", "javascript"],
    ["yml", "yaml"],
    ["c++", "cpp"],
  ])("canonicalizes the %s hint", async (hint, id) => {
    const block = await codeOf(`<pre data-lang="${hint}"><code>x</code></pre>`);
    expect(block.language).toBe(id);
  });

  test("falls back to the filename extension when the hint is absent or unknown", async () => {
    const named = await codeOf(`<pre data-filename="main.rs"><code>fn main() {}</code></pre>`);
    expect(named).toMatchObject({
      language: "rust",
      languageSource: "filename",
      filename: "main.rs",
    });
    const unknown = await codeOf(
      `<pre data-lang="not-a-language" data-filename="a.go"><code>package a</code></pre>`,
    );
    expect(unknown).toMatchObject({ language: "go", languageSource: "filename" });
  });

  test("recognizes Dockerfile and similar names without an extension", async () => {
    const block = await codeOf(`<pre data-filename="Dockerfile"><code>FROM node</code></pre>`);
    expect(block.language).toBe("docker");
  });

  test.each([
    ["#!/usr/bin/env python3\nprint(1)", "python"],
    ["#!/bin/bash\necho hi", "shellscript"],
    ["#!/usr/bin/env node\nconsole.log(1)", "javascript"],
    ["# vim: set ft=ruby:\nputs 1", "ruby"],
  ])("detects the language from the content: %#", async (value, id) => {
    const block = await codeOf(`<pre><code>${value}</code></pre>`);
    expect(block).toMatchObject({ language: id, languageSource: "shebang" });
  });

  test("an explicit plain-text hint stays plain and is not highlighted", async () => {
    const block = await codeOf(
      `<pre data-lang="text" data-filename="a.ts"><code>just text</code></pre>`,
    );
    expect(block).toMatchObject({
      language: null,
      languageSource: "explicit",
      label: "Plain text",
    });
    expect(block.highlight).toBeUndefined();
  });

  test("without any hint a short block is plain text, never classified", async () => {
    const block = await codeOf(`<pre><code>function looksLikeJs() { return 1; }</code></pre>`);
    expect(block).toMatchObject({ language: null, languageSource: "none", label: "Plain text" });
    expect(block.highlight).toBeUndefined();
  });

  test("stores pinned dual-theme tokens whose text rebuilds the code", async () => {
    const block = await codeOf(`<pre data-lang="ts"><code>const a = 1;\nlet b = "x";</code></pre>`);
    const highlight = block.highlight!;
    expect(highlight.engine).toBe("shiki@4.5.0:github-light/github-dark");
    expect(highlight.styles[0]).toEqual({});
    expect(highlight.styles.slice(1).every((style) => style.light && style.dark)).toBe(true);
    expect(highlight.lines.map((line) => line.map(([text]) => text).join("")).join("\n")).toBe(
      block.value,
    );
    expect(highlight.lines.flat().every(([, style]) => style < highlight.styles.length)).toBe(true);
  });

  test("skips highlighting past the size cap but keeps the resolved language", async () => {
    const block = await codeOf(
      `<pre data-lang="ts"><code>${"const a = 1;\n".repeat(2000)}</code></pre>`,
    );
    expect(block).toMatchObject({ language: "typescript" });
    expect(block.highlight).toBeUndefined();
  });

  test("keeps highlight line numbers from the source", async () => {
    const block = await codeOf(`<pre data-lang="ts" data-line="2"><code>a\nb\nc</code></pre>`);
    expect(block.highlightLines).toEqual([2]);
  });

  test("tokenizes the same snippet identically on every call", async () => {
    const html = `<pre data-lang="js"><code>const importer = createImporter({ stream: true });</code></pre>`;
    const first = await codeOf(html);
    await codeOf(`<pre data-lang="ts"><code>let a: number = 1;</code></pre>`);
    const second = await codeOf(html);
    expect(second.highlight).toEqual(first.highlight);
  });
});

describe("code (pass 13) conservative detection", () => {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const detect = (value: string) => codeOf(`<pre><code>${escape(value)}</code></pre>`);

  test.each([
    [
      "python",
      `import os\nfrom pathlib import Path\n\ndef main(path):\n    for f in Path(path).iterdir():\n        print(f.name)\n`,
    ],
    ["toml", `[package]\nname = "gawain"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"\n`],
    ["shell session", `$ pip install gawain\n$ gawain init\n$ gawain run --watch\n`],
    [
      "shell script",
      `curl -fsSL https://example.com/install.sh | sh\nexport PATH="$HOME/.local/bin:$PATH"\ngawain --version\n`,
    ],
    [
      "ruby",
      `class Greeter\n  def initialize(name)\n    @name = name\n  end\n\n  def hello\n    puts "Hello, #{@name}"\n  end\nend\n`,
    ],
    [
      "rust",
      `fn main() {\n    let values: Vec<i32> = vec![1, 2, 3];\n    for v in values.iter() {\n        println!("{}", v);\n    }\n}\n`,
    ],
    [
      "go",
      `package main\n\nimport "fmt"\n\nfunc main() {\n\tfor i := 0; i < 3; i++ {\n\t\tfmt.Println(i)\n\t}\n}\n`,
    ],
    ["json", `{\n  "name": "gawain",\n  "version": "0.1.0",\n  "scripts": { "build": "tsc" }\n}\n`],
  ])("colours an unhinted %s snippet without labelling it", async (_name, value) => {
    const block = await detect(value);
    expect(block).toMatchObject({ language: null, languageSource: "none", label: "Plain text" });
    expect(block.highlight).toBeDefined();
    expect(block.highlight!.styles.length).toBeGreaterThan(1);
    expect(block.highlight!.lines.map((line) => line.map(([t]) => t).join("")).join("\n")).toBe(
      block.value,
    );
  });

  test.each([
    ["short", `x = 1\ny = 2`],
    [
      "prose",
      `This is some output that looks like prose.\nIt has several lines of text in it.\nNothing to see here at all, really.\n`,
    ],
    ["table", `name    age\nalice   30\nbob     25\n`],
    [
      "build output",
      `Compiling gawain v0.1.0\n    Finished dev [unoptimized] target(s) in 1.2s\n     Running target/debug/gawain\n`,
    ],
  ])("leaves %s plain", async (_name, value) => {
    const block = await detect(value);
    expect(block.highlight).toBeUndefined();
    expect(block.language).toBeNull();
  });

  test("never overrides an explicit hint or plain-text request", async () => {
    const python = `import os\nfrom pathlib import Path\n\ndef main(path):\n    print(path)\n`;
    const plain = await codeOf(`<pre data-lang="text"><code>${python}</code></pre>`);
    expect(plain.highlight).toBeUndefined();
    const hinted = await codeOf(`<pre data-lang="ruby"><code>${python}</code></pre>`);
    expect(hinted).toMatchObject({ language: "ruby", languageSource: "explicit" });
  });

  test("detection is deterministic", async () => {
    const value = `[package]\nname = "gawain"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"\n`;
    const first = await detect(value);
    await detect(`$ pip install gawain\n$ gawain init\n$ gawain run --watch\n`);
    expect((await detect(value)).highlight).toEqual(first.highlight);
  });
});

describe("code (pass 13) context and deterministic shapes", () => {
  const blocksOf = async (html: string) =>
    (await run(html)).blocks.filter((block) => block.type === "code");

  test("a file named in the paragraph before the block sets its language and label", async () => {
    const [block] = await blocksOf(
      `<p>Given <code>shop.py</code>:</p><pre><code>PORT = 8080\nretries = 3\n</code></pre>`,
    );
    expect(block).toMatchObject({
      language: "python",
      languageSource: "filename",
      label: "Python",
    });
    expect(block?.type === "code" && block.highlight).toBeTruthy();
  });

  test("a block introduced as output is never coloured", async () => {
    const [block] = await blocksOf(
      `<p><code>gawain check shop.py</code> prints:</p><pre><code>shop.py:1:1    GW001 variable 'PORT' has no annotation\nshop.py:2:1    GW001 variable 'retries' has no annotation\n</code></pre>`,
    );
    expect(block).toMatchObject({ language: null, label: "Plain text" });
    expect(block?.type === "code" && block.highlight).toBeFalsy();
  });

  test("diagnostics without an introduction stay plain", async () => {
    const [block] = await blocksOf(
      `<pre><code>[presence]\nshop.py:1:1    GW001 variable 'PORT' has no annotation\nshop.py:2:1    GW001 variable 'retries' has no annotation\n</code></pre>`,
    );
    expect(block?.type === "code" && block.highlight).toBeFalsy();
  });

  test("a short toml table and one-line install commands are coloured", async () => {
    const blocks = await blocksOf(
      `<pre><code>[tool.gawain]\nmode = "strict"</code></pre><pre><code>uv tool install "gawain[ty]"  # or pip install "gawain[ty]"</code></pre>`,
    );
    for (const block of blocks) {
      expect(block.type === "code" && block.highlight).toBeTruthy();
      expect(block).toMatchObject({ language: null, languageSource: "none" });
    }
  });

  test("an explicit hint still wins over the introduction", async () => {
    const [block] = await blocksOf(
      `<p>See <code>notes.py</code>:</p><pre class="language-ruby"><code>puts 1</code></pre>`,
    );
    expect(block).toMatchObject({ language: "ruby", languageSource: "explicit" });
  });
});
