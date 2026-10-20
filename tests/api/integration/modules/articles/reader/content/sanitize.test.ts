import { describe, expect, test } from "bun:test";
import { htmlToText, sanitizeArticleHtml } from "@modules/articles/reader/content";

describe("articles.sanitize.content", () => {
  test("preserves headings, lists, code blocks, tables, and strips scripts", () => {
    const sanitized = sanitizeArticleHtml(`
      <article>
        <h1>Title</h1>
        <p>Intro</p>
        <script>alert("x")</script>
        <ul><li>One</li><li>Two</li></ul>
        <pre><code class="language-ts">const x = 1;</code></pre>
        <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>
      </article>
    `);

    expect(sanitized).toContain("<h1>Title</h1>");
    expect(sanitized).toContain("<ul><li>One</li><li>Two</li></ul>");
    expect(sanitized).toContain('<pre><code class="language-ts">const x = 1;</code></pre>');
    expect(sanitized).toContain("<table>");
    expect(sanitized).not.toContain("<script>");

    const text = htmlToText(sanitized);
    expect(text).toContain("Title");
    expect(text).toContain("const x = 1;");
    expect(text).toContain("One");
  });

  test("resolves relative links/images against base URL and strips unsafe schemes", () => {
    const sanitized = sanitizeArticleHtml(
      `
      <p><a href="/docs/start">Start</a></p>
      <img src="../assets/diagram.png" alt="diagram">
      <a href="javascript:alert(1)">bad</a>
      `,
      { baseUrl: "https://example.com/posts/2026/update" },
    );

    expect(sanitized).toContain('href="https://example.com/docs/start"');
    expect(sanitized).toContain('src="https://example.com/posts/assets/diagram.png"');
    expect(sanitized).not.toContain("javascript:");
  });

  test("preserves div-based author layout, filtered classes, and strips scripts", () => {
    const sanitized = sanitizeArticleHtml(`
      <div class="author-bio media-object wp-block-group">
        <img src="https://example.com/a.png" alt="Author" class="avatar photo" />
        <div class="bio-text">
          <p class="name">Author Name</p>
          <p>Short bio.</p>
          <a href="https://example.com/profile" class="button promo-link">Profile</a>
        </div>
      </div>
      <script>alert(1)</script>
    `);

    expect(sanitized).toContain("<div");
    expect(sanitized).toContain("author-bio");
    expect(sanitized).toContain("media-object");
    expect(sanitized).toContain("wp-block-group");
    expect(sanitized).toContain("avatar");
    expect(sanitized).toContain("<img");
    expect(sanitized).toContain("Author Name");
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("promo");
  });

  test("strips TypeDoc data-tsd-* attributes and empty style on allowed tags", () => {
    const sanitized = sanitizeArticleHtml(`
      <div class="article-body" data-tsd-source="/src/components/foo.ts" style="">
        <p>Hello</p>
      </div>
    `);

    expect(sanitized).not.toContain("data-tsd-source");
    expect(sanitized).not.toContain("tsd-source");
    expect(sanitized).toContain("<p>Hello</p>");
  });

  test("normalizes dangerous attrs, URL schemes, classes, image attrs, and empty wrappers", () => {
    const sanitized = sanitizeArticleHtml(`
      <article>
        <p onclick="alert(1)">Intro</p>
        <a href="vbscript:msgbox(1)" onmouseover="alert(1)">bad link</a>
        <img src="data:text/html;base64,PHNjcmlwdD4=" onerror="alert(1)" alt="bad image">
        <pre><code class="language-ts prettyprint promo">const x = 1;</code></pre>
        <div class="author-bio promo sidebar" style="color: red"><span style="color: red">Author</span></div>
        <div></div>
        <math style="color: red"><mrow><mi>x</mi></mrow></math>
      </article>
    `);

    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("onmouseover");
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("vbscript:");
    expect(sanitized).not.toContain("data:text/html");
    expect(sanitized).toContain('<code class="language-ts">const x = 1;</code>');
    expect(sanitized).toContain('class="author-bio"');
    expect(sanitized).not.toContain("promo");
    expect(sanitized).not.toContain("sidebar");
    expect(sanitized).not.toContain('<div class="author-bio" style=');
    expect(sanitized).toContain('<span style="color: red">Author</span>');
    expect(sanitized).toContain('<math style="color: red">');
    expect(sanitized).not.toContain("<div></div>");
  });

  test("adds lazy image defaults after sanitization", () => {
    const sanitized = sanitizeArticleHtml(`
      <p><img src="https://example.com/image.jpg" alt="Image"></p>
    `);

    expect(sanitized).toContain('loading="lazy"');
    expect(sanitized).toContain('decoding="async"');
  });
});

describe("articles.sanitize.content – carousel artifact stripping", () => {
  test("removes lists where every item is a single bullet character", () => {
    const html = `
      <p>Real content.</p>
      <ul>
        <li>•</li>
        <li>•</li>
        <li>•</li>
      </ul>
      <p>More content.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
    expect(result).not.toContain("<li");
    expect(result).toContain("Real content");
    expect(result).toContain("More content");
  });

  test("preserves bare-numbered <ol> (legitimate ordered list)", () => {
    const html = `
      <ol>
        <li>1</li>
        <li>2</li>
        <li>3</li>
      </ol>
      <p>Article text.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).toContain("<ol");
    expect(result).toContain("Article text");
  });

  test("removes bare-numbered <ul> (carousel pagination dots)", () => {
    const html = `
      <ul>
        <li>1</li>
        <li>2</li>
        <li>3</li>
      </ul>
      <p>Article text.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
    expect(result).toContain("Article text");
  });

  test("removes empty lists", () => {
    const html = `
      <ul></ul>
      <p>Content.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
    expect(result).toContain("Content");
  });

  test("preserves lists with real text content", () => {
    const html = `
      <ul>
        <li>First important point about the topic at hand.</li>
        <li>Second important point with supporting detail.</li>
        <li>Third point wrapping up the argument.</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).toContain("<ul");
    expect(result).toContain("First important point");
  });

  test("removes lists with single unicode dot characters (●, ○, ◦)", () => {
    const html = `
      <ul>
        <li>●</li>
        <li>○</li>
        <li>◦</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
  });

  test("preserves mixed lists where some items have real text", () => {
    const html = `
      <ul>
        <li>1. Install the software</li>
        <li>2. Configure the settings</li>
        <li>3. Run the demo</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).toContain("<ul");
    expect(result).toContain("Install the software");
  });

  test("removes lists with carousel CSS classes even if items have text", () => {
    const html = `
      <ul class="carousel-dots">
        <li>slide one</li>
        <li>slide two</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("carousel");
  });
});

describe("articles.sanitize.content – policy v2", () => {
  const baseUrl = "https://example.com/posts/entry";

  test("keeps publisher inline semantics, definition lists, annotations, and direction", () => {
    const sanitized = sanitizeArticleHtml(
      `<p lang="en" dir="ltr"><b>bold</b> <i>italic</i> <u>under</u> <s>old</s> <del datetime="2026-10-01">cut</del> <ins datetime="2026-10-02">added</ins> <kbd>K</kbd> <samp>out</samp> <var>n</var> <small>fine</small> <cite>Work</cite> <q>quoted</q> <time datetime="2026-10-20">today</time></p>
       <dl><dt>Term</dt><dd>Definition</dd></dl>
       <p lang="ja"><ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby> <bdi>إيمان</bdi> long<wbr>word</p>
       <p lang="en&quot;x" dir="sideways">bad direction</p>`,
      { baseUrl },
    );

    for (const tag of ["b", "i", "u", "s", "kbd", "samp", "var", "small", "cite", "q"]) {
      expect(sanitized).toContain(`<${tag}>`);
    }
    expect(sanitized).toContain('<del datetime="2026-10-01">cut</del>');
    expect(sanitized).toContain('<ins datetime="2026-10-02">added</ins>');
    expect(sanitized).toContain('<time datetime="2026-10-20">today</time>');
    expect(sanitized).toContain('<p lang="en" dir="ltr">');
    expect(sanitized).toContain("<dl><dt>Term</dt><dd>Definition</dd></dl>");
    expect(sanitized).toContain("<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>");
    expect(sanitized).toContain("<bdi>إيمان</bdi>");
    expect(sanitized).toContain("long<wbr>word");
    expect(sanitized).toContain("<p>bad direction</p>");
  });

  test("keeps table captions, footers, cell alignment, and empty cells", () => {
    const sanitized = sanitizeArticleHtml(
      `<table><caption>Revenue</caption><thead><tr><th scope="col" align="right">2026</th><th scope="sideways">x</th></tr></thead>
       <tbody><tr><td align="right" colspan="2">1</td><td></td></tr></tbody><tfoot><tr><td>Total</td></tr></tfoot></table>`,
      { baseUrl },
    );

    expect(sanitized).toContain("<caption>Revenue</caption>");
    expect(sanitized).toContain('<th scope="col" align="right">2026</th>');
    expect(sanitized).toContain("<th>x</th>");
    expect(sanitized).toContain('<td align="right" colspan="2">1</td><td></td>');
    expect(sanitized).toContain("<tfoot><tr><td>Total</td></tr></tfoot>");
  });

  test("keeps http(s) srcset candidates, including CDN URLs with commas", () => {
    const sanitized = sanitizeArticleHtml(
      `<picture><source type="image/webp" media="(min-width: 600px)" sizes="100vw" srcset="https://cdn.example/w_424,f_webp/a.png 424w, javascript:alert(1) 800w, https://cdn.example/w_848,f_webp/a.png 848w">
       <img src="https://cdn.example/a.png" alt="a" width="848" height="400" sizes="100vw" srcset="data:text/html,x 1x, https://cdn.example/a@2x.png 2x, https://cdn.example/bad.png 100w 2x"></picture>
       <img src="https://cdn.example/b.png" alt="b" srcset="javascript:alert(1) 1x">`,
      { baseUrl },
    );

    expect(sanitized).toContain(
      '<source type="image/webp" media="(min-width: 600px)" sizes="100vw" srcset="https://cdn.example/w_424,f_webp/a.png 424w, https://cdn.example/w_848,f_webp/a.png 848w">',
    );
    expect(sanitized).toContain('srcset="https://cdn.example/a@2x.png 2x"');
    expect(sanitized).toContain('width="848" height="400"');
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain("data:text/html");
    expect(sanitized).not.toContain("bad.png");
    expect(sanitized).toMatch(/<img src="https:\/\/cdn\.example\/b\.png" alt="b" loading="lazy"/);
  });

  test("caps srcset at eight candidates", () => {
    const candidates = Array.from(
      { length: 12 },
      (_, index) => `https://cdn.example/${index}.png ${index + 1}00w`,
    );
    const sanitized = sanitizeArticleHtml(
      `<img src="https://cdn.example/a.png" alt="" srcset="${candidates.join(", ")}">`,
      { baseUrl },
    );

    expect(sanitized.match(/https:\/\/cdn\.example\/\d+\.png/g)).toHaveLength(8);
  });

  test("forces click-to-play media and drops players without a playable source", () => {
    const sanitized = sanitizeArticleHtml(
      `<video src="https://media.example/v.mp4" poster="https://media.example/v.jpg" autoplay muted loop playsinline width="1280" height="720"></video>
       <video src="https://media.example/w.mp4" poster="data:text/html,x"></video>
       <audio preload="auto"><source src="https://media.example/a.mp3" type="audio/mpeg"></audio>
       <video src="javascript:alert(1)"></video>
       <audio></audio>`,
      { baseUrl },
    );

    expect(sanitized).toContain(
      '<video src="https://media.example/v.mp4" poster="https://media.example/v.jpg" playsinline="" width="1280" height="720" controls="" preload="none"></video>',
    );
    expect(sanitized).toContain(
      '<video src="https://media.example/w.mp4" controls="" preload="none"></video>',
    );
    expect(sanitized).toContain(
      '<audio preload="none" controls=""><source src="https://media.example/a.mp3" type="audio/mpeg"></audio>',
    );
    expect(sanitized).not.toMatch(/autoplay|muted|loop|javascript:/);
    expect(sanitized.match(/<video/g)).toHaveLength(2);
    expect(sanitized.match(/<audio/g)).toHaveLength(1);
  });

  test("keeps only kyomi- ids and in-page links, including empty anchor targets", () => {
    const sanitized = sanitizeArticleHtml(
      `<p>Claim<sup><a href="#kyomi-fn-1">1</a></sup> and <a href="#fn-1">raw fragment</a>.</p>
       <h2 id="location">Raw id</h2><h2 id="kyomi-intro">Prefixed id</h2>
       <p><a id="kyomi-fnref-1"></a>Target</p><p id="kyomi-Bad_Id">Upper case</p>`,
      { baseUrl },
    );

    expect(sanitized).toContain('<a href="#kyomi-fn-1">1</a>');
    expect(sanitized).toContain('<a href="https://example.com/posts/entry#fn-1">raw fragment</a>');
    expect(sanitized).toContain("<h2>Raw id</h2>");
    expect(sanitized).toContain('<h2 id="kyomi-intro">Prefixed id</h2>');
    expect(sanitized).toContain('<a id="kyomi-fnref-1"></a>Target');
    expect(sanitized).toContain("<p>Upper case</p>");
  });

  test("keeps well-formed compiler hints on their tags and drops forged or misplaced ones", () => {
    const sanitized = sanitizeArticleHtml(
      `<pre data-kyomi-lang="ts" data-kyomi-filename="src/server.ts" data-kyomi-lines="2-3, 5"><code>a</code></pre>
       <pre data-kyomi-lang="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;" data-kyomi-lines="all"><code>b</code></pre>
       <figure data-kyomi-embed="youtube" data-kyomi-url="https://www.youtube.com/watch?v=abc"><a href="https://www.youtube.com/watch?v=abc">Video</a></figure>
       <figure data-kyomi-embed="myspace" data-kyomi-url="javascript:alert(1)"><a href="https://example.org/">Post</a></figure>
       <p data-kyomi-embed="youtube" data-kyomi-url="https://www.youtube.com/watch?v=abc">Misplaced</p>
       <ul><li data-kyomi-checked="true">Done</li><li data-kyomi-checked="maybe">Unknown</li></ul>`,
      { baseUrl },
    );

    expect(sanitized).toContain(
      '<pre data-kyomi-lang="ts" data-kyomi-filename="src/server.ts" data-kyomi-lines="2-3, 5"><code>a</code></pre>',
    );
    expect(sanitized).toContain("<pre><code>b</code></pre>");
    expect(sanitized).toContain(
      '<figure data-kyomi-embed="youtube" data-kyomi-url="https://www.youtube.com/watch?v=abc">',
    );
    expect(sanitized).toContain('<figure><a href="https://example.org/">Post</a></figure>');
    expect(sanitized).toContain("<p>Misplaced</p>");
    expect(sanitized).toContain('<li data-kyomi-checked="true">Done</li><li>Unknown</li>');
  });

  test("keeps MathML layout and drops HTML-carrying MathML elements", () => {
    const sanitized = sanitizeArticleHtml(
      `<math display="block"><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup><mroot><mi>n</mi><mn>3</mn></mroot>
       <mtable><mtr><mtd><mn>1</mn></mtd></mtr></mtable><mspace></mspace></math>
       <math><semantics><mi>y</mi><annotation-xml encoding="text/html"><b>hidden</b></annotation-xml></semantics></math>
       <math><maction actiontype="statusline"><mi>z</mi><mtext>status</mtext></maction></math>`,
      { baseUrl },
    );

    expect(sanitized).toContain('<math display="block"><msubsup>');
    expect(sanitized).toContain("<mroot><mi>n</mi><mn>3</mn></mroot>");
    expect(sanitized).toContain("<mtable><mtr><mtd><mn>1</mn></mtd></mtr></mtable><mspace></mspace>");
    expect(sanitized).not.toMatch(/annotation-xml|maction/);
  });

  test("keeps editorial asides and quote attribution footers", () => {
    const sanitized = sanitizeArticleHtml(
      `<aside class="note promo"><p>An aside.</p></aside>
       <blockquote><p>Quote.</p><footer>Author, <cite>Book</cite></footer></blockquote>`,
      { baseUrl },
    );

    expect(sanitized).toContain('<aside class="note"><p>An aside.</p></aside>');
    expect(sanitized).toContain("<footer>Author, <cite>Book</cite></footer>");
  });
});
