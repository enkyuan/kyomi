import { describe, expect, test } from "bun:test";
import { runPass } from "./run-pass";

describe("compiler pass: strip-chrome", () => {
  test("removes interactive elements with their content and counts each removal", () => {
    const { html, diagnostics } = runPass(
      "strip-chrome",
      `<p>Body</p><form><input name="email"><button>Subscribe now</button></form><nav><a href="/a">Archive</a></nav>
       <svg><title>Logo</title></svg><label for="x">⊕</label><script>alert(1)</script><iframe src="https://ads.example/"></iframe>`,
    );

    expect(html).toBe("<p>Body</p>");
    expect(diagnostics.droppedElements).toEqual({
      form: 1,
      iframe: 1,
      label: 1,
      nav: 1,
      script: 1,
      svg: 1,
    });
  });

  test("keeps quote and figure attribution footers but drops page footers", () => {
    const { html } = runPass(
      "strip-chrome",
      `<blockquote><p>Q</p><footer>Author</footer></blockquote><figure><img src="a.png" alt=""><footer>Credit</footer></figure><footer>Unsubscribe</footer>`,
    );

    expect(html).toContain("<footer>Author</footer>");
    expect(html).toContain("<footer>Credit</footer>");
    expect(html).not.toContain("Unsubscribe");
  });

  test("drops calls to action and share bars, but not article sections that share a class word", () => {
    const { html } = runPass(
      "strip-chrome",
      `<div class="subscription-widget"><p>Thanks for reading! Subscribe for free.</p></div>
       <div class="share-buttons"><a href="https://x.com/intent">Post this</a></div>
       <section class="newsletter-archive"><h2>Past issues</h2><p>${"Long archive text. ".repeat(40)}</p></section>`,
    );

    expect(html).not.toContain("Thanks for reading");
    expect(html).not.toContain("Post this");
    expect(html).toContain("<h2>Past issues</h2>");
  });

  test("removes image-viewer prompts, heading permalinks, and code line anchors", () => {
    const { html } = runPass(
      "strip-chrome",
      `<figure><span>Press enter or click to view image in full size</span><img src="a.png" alt=""></figure>
       <h2 id="kyomi-config">Configuration<a href="#kyomi-config">​</a></h2>
       <pre><code><a id="kyomi-line-1" href="#kyomi-line-1"></a>./install.sh <a href="#kyomi-line-1">ref</a></code></pre>`,
    );

    expect(html).not.toContain("Press enter");
    expect(html).toContain('<h2 id="kyomi-config">Configuration</h2>');
    expect(html).toContain("<pre><code>./install.sh ref</code></pre>");
  });

  test("drops MathML alternate markup", () => {
    const { html } = runPass(
      "strip-chrome",
      `<math><semantics><mi>x</mi><annotation-xml encoding="text/html"><img src="x" onerror="alert(1)"></annotation-xml></semantics></math>`,
    );

    expect(html).toBe("<math><semantics><mi>x</mi></semantics></math>");
  });
});
