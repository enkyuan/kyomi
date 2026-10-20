import { describe, expect, test } from "bun:test";
import { runPass } from "./run-pass";

function hints(html: string): Record<string, string>[] {
  return Array.from(html.matchAll(/<pre([^>]*)>/g), (match) =>
    Object.fromEntries(
      Array.from(match[1]!.matchAll(/data-kyomi-([a-z]+)="([^"]*)"/g), (attr) => [
        attr[1]!,
        attr[2]!,
      ]),
    ),
  );
}

describe("compiler pass: capture-code-hints", () => {
  test("reads the language from code, pre, and highlighter wrappers in that order", () => {
    const { html } = runPass(
      "capture-code-hints",
      `<pre class="lang-go"><code class="language-rust">a</code></pre>
       <pre class="brush: php; gutter: false">b</pre>
       <pre><code class="hljs language-elixir">c</code></pre>
       <div class="language-ruby highlighter-rouge"><div class="highlight"><pre class="highlight"><code>d</code></pre></div></div>
       <div class="highlight highlight-source-js"><pre>e</pre></div>
       <div class="code-block" data-language="haskell"><pre><code>f</code></pre></div>
       <pre data-lang="Bash"><code>g</code></pre>
       <pre>h</pre>`,
    );

    expect(hints(html).map((hint): string | null => hint.lang ?? null)).toEqual([
      "rust",
      "php",
      "elixir",
      "ruby",
      "js",
      "haskell",
      "Bash",
      null,
    ]);
  });

  test("captures and removes a filename title bar or filename-only caption", () => {
    const { html } = runPass(
      "capture-code-hints",
      `<div class="language-bash highlight"><span class="filename">install.sh</span><pre><code>./install.sh</code></pre></div>
       <figure><figcaption>server.ts</figcaption><pre><code class="language-ts">serve()</code></pre></figure>
       <figure><figcaption>Figure 2: the request path</figcaption><pre><code>x</code></pre></figure>`,
    );

    expect(hints(html)).toEqual([
      { lang: "bash", filename: "install.sh" },
      { lang: "ts", filename: "server.ts" },
      {},
    ]);
    expect(html).not.toContain(">install.sh<");
    expect(html).toContain("<figcaption>Figure 2: the request path</figcaption>");
  });

  test("captures Prism and Chroma highlighted lines", () => {
    const { html } = runPass(
      "capture-code-hints",
      `<pre data-line="2-3"><code class="language-sql">a</code></pre>
       <pre><code class="language-rust"><span class="line">a</span><span class="line hl">b</span><span class="line hl">c</span></code></pre>`,
    );

    expect(hints(html)).toEqual([
      { lang: "sql", lines: "2-3" },
      { lang: "rust", lines: "2,3" },
    ]);
  });

  test("drops Chroma line-number gutters and publisher token colours", () => {
    const { html } = runPass(
      "capture-code-hints",
      `<table class="lntable"><tr><td><pre><code><span>1</span></code></pre></td><td><pre><code class="language-go"><span style="color:#00f">package</span> main</code></pre></td></tr></table>`,
    );

    expect(html).toBe(
      '<pre data-kyomi-lang="go"><code class="language-go"><span>package</span> main</code></pre>',
    );
  });

  test("records task-list checkbox state on the list item", () => {
    const { html } = runPass(
      "capture-code-hints",
      `<ul><li><input type="checkbox" checked disabled> Done</li><li><input type="checkbox" disabled> Open</li><li>Plain</li></ul>`,
    );

    expect(html).toContain('<li data-kyomi-checked="true">');
    expect(html).toContain('<li data-kyomi-checked="false">');
    expect(html).toContain("<li>Plain</li>");
  });
});
