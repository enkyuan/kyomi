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

  test("without any hint the block is plain text, never classified", async () => {
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
