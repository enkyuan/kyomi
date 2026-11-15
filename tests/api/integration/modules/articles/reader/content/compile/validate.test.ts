import { describe, expect, test } from "bun:test";
import {
  compileArticleDocument,
  documentInvariantIssues,
  validate,
  type DocumentDraft,
} from "@kyomi/worker/document";
import { runThrough } from "./document-helpers";

async function draftOf(html: string): Promise<DocumentDraft> {
  return runThrough(html, "derive", { title: "T" });
}

describe("validate (pass 18)", () => {
  test("returns the parsed document for a well-formed draft", async () => {
    const draft = await draftOf(`<h2 id="a">A</h2><p>Text <a href="#a">link</a></p>`);
    const document = validate(draft);
    expect(document).not.toBeNull();
    expect(document?.version).toBe(1);
    expect(draft.diagnostics.warnings).toEqual([]);
  });

  test("fails with no document and a warning when the schema rejects the tree", async () => {
    const draft = await draftOf(`<p>Text</p>`);
    draft.blocks.push({
      type: "figure",
      placement: "content",
      image: { src: "javascript:alert(1)", alt: "" },
    });
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toStartWith("validation-failed:");
  });

  test("rejects duplicate anchors across blocks and footnotes", async () => {
    const draft = await draftOf(`<h2 id="a">A</h2><p>x</p>`);
    draft.blocks.push({
      type: "paragraph",
      anchor: "kyomi-a",
      children: [{ type: "text", value: "dup" }],
    });
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toBe("validation-failed:duplicate-anchor:kyomi-a");
  });

  test("rejects a footnote reference that resolves to no footnote", async () => {
    const draft = await draftOf(`<p>x</p>`);
    draft.blocks.push({
      type: "paragraph",
      children: [{ type: "footnoteRef", id: "fn-9", label: "9" }],
    });
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toBe("validation-failed:unresolved-footnote-ref:fn-9");
  });

  test("rejects fragment links that resolve to no anchor", async () => {
    const draft = await draftOf(`<p>x</p>`);
    draft.blocks.push({
      type: "paragraph",
      children: [{ type: "link", href: "#nowhere", children: [{ type: "text", value: "x" }] }],
    });
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toBe("validation-failed:unresolved-fragment:#nowhere");
  });

  test("rejects nested links", async () => {
    const draft = await draftOf(`<p>x</p>`);
    const inner = {
      type: "link" as const,
      href: "https://a.example/",
      children: [{ type: "text" as const, value: "i" }],
    };
    draft.blocks.push({
      type: "paragraph",
      children: [{ type: "link", href: "https://b.example/", children: [inner] }],
    });
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toBe("validation-failed:nested-link");
  });

  test("rejects a frameUrl that is not the provider template", async () => {
    const draft = await runThrough(
      `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`,
      "derive",
    );
    const embed = draft.blocks[0]!;
    if (embed.type !== "embed") {
      throw new Error("expected an embed");
    }
    embed.frameUrl = "https://evil.example/embed/dQw4w9WgXcQ";
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toBe(
      "validation-failed:embed-frame-not-allowlisted:youtube",
    );
  });

  test("rejects highlight tokens that do not rebuild the code or index outside the styles", async () => {
    const draft = await draftOf(`<pre data-lang="ts"><code>const a = 1;</code></pre>`);
    const code = draft.blocks[0]!;
    if (code.type !== "code" || !code.highlight) {
      throw new Error("expected a highlighted code block");
    }
    const original = structuredClone(code.highlight);
    code.highlight.lines[0]![0]![0] = "X";
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings.at(-1)).toBe("validation-failed:highlight-text-mismatch");

    code.highlight = original;
    code.highlight.lines[0]![0]![1] = 99;
    draft.diagnostics.warnings.length = 0;
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toBe("validation-failed:highlight-style-out-of-range");
  });

  test("rejects features that do not match the tree", async () => {
    const draft = await draftOf(`<p>x</p>`);
    draft.features = { math: true, codeLanguages: [], embedProviders: [] };
    expect(validate(draft)).toBeNull();
    expect(draft.diagnostics.warnings[0]).toBe("validation-failed:features-mismatch");
  });

  test("documentInvariantIssues is empty for compiler output", async () => {
    const { document } = await compileArticleDocument({
      body: `<h2 id="a">A</h2><p>Hi<a href="#n">1</a> <a href="#a">up</a></p><ol class="footnotes"><li id="n">Note</li></ol>`,
      origin: "feed_html",
      baseUrl: "https://example.com/",
    });
    expect(document).not.toBeNull();
    expect(documentInvariantIssues(document!)).toEqual([]);
  });
});
