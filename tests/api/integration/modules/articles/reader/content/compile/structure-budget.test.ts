import { describe, expect, test } from "bun:test";
import {
  compileArticleDocument,
  compileArticleHtml,
  parseArticleFragment,
} from "@kyomi/ingest/document";
import {
  isTreeWithinStructureBudget,
  isWithinStructureBudget,
  MAX_ATTRIBUTES,
  MAX_ATTRIBUTES_PER_ELEMENT,
  MAX_DEPTH_SUM,
  MAX_ELEMENTS,
  MAX_NESTING_DEPTH,
  measureStructure,
} from "../../../../../../../../packages/ingest/src/document/structure-budget";

/**
 * The structure budget replays the parser's tokenizer and open-element stack instead of estimating
 * from tag text. These pin that replay to the parser the compiler really uses (linkedom, which is
 * htmlparser2 in HTML mode) and pin the shapes that an estimate once let through.
 */

const BASE = "https://example.com/posts/entry";
const repeat = (text: string, count: number) => text.repeat(count);

/** What the parser built from `html`, measured without recursion. */
function parsed(html: string) {
  const { root } = parseArticleFragment(html);
  let depth = 0;
  let deepest = 0;
  let elements = 0;
  let depthSum = 0;
  let node = root.firstElementChild;
  while (node) {
    elements += 1;
    depthSum += depth + 1;
    deepest = Math.max(deepest, depth + 1);
    if (node.firstElementChild) {
      depth += 1;
      node = node.firstElementChild;
      continue;
    }
    let next = node.nextElementSibling;
    while (!next) {
      const parent: Element | null = node.parentElement;
      if (!parent || parent === root) {
        return { depth: deepest, elements, depthSum };
      }
      depth -= 1;
      node = parent;
      next = node.nextElementSibling;
    }
    node = next;
  }
  return { depth: deepest, elements, depthSum };
}

describe("the scan reads a body as the parser does", () => {
  test("a small body has the depth, elements and depth sum of the tree", () => {
    expect(measureStructure("<div><p>a</p><span><b>x</b></span></div>")).toMatchObject({
      exceeded: false,
      depth: 3,
      elements: 4,
      depthSum: 8,
    });
    // Optional end tags and void elements: `<li>` closes `<li>`, `<br>` and `<img>` never open.
    expect(measureStructure("<ul><li>a<li>b<li>c</ul><p>x<br>y<img src=a>")).toMatchObject({
      depth: 2,
      elements: 7,
    });
  });

  test("an unclosed inline element is closed by its container's end tag", () => {
    expect(measureStructure(repeat("<p><b>text</p>", 1_000)).exceeded).toBe(false);
    expect(measureStructure(`<ul>${repeat("<li><span>text</li>", 1_000)}</ul>`).exceeded).toBe(
      false,
    );
    expect(
      measureStructure(`<table>${repeat("<tr><td><font>x</td></tr>", 1_000)}</table>`).exceeded,
    ).toBe(false);
  });

  test("an article with one unclosed inline element per paragraph keeps its markup", () => {
    const html = compileArticleHtml(repeat("<p><b>Note: text</p>", 6_000), { baseUrl: BASE }).html;

    expect(html).toContain("<b>Note: text</b>");
    expect(html.match(/<p>/g)).toHaveLength(6_000);
  });

  // Generated markup: tag names, quotes, comments, raw text elements and stray punctuation in
  // every order. The scan must agree with the tree the parser builds for each of them.
  const TOKENS = [
    ...["<", ">", "/", "!", "-", "?", "[", "]", "=", '"', "'", " ", "\n", "&", ";", "x", "a", "b"],
    ...["p", "li", "div", "span", "script", "style", "title", "textarea", "xmp", "tmp", "xitle"],
    ...["svg", "math", "mi", "foreignObject", "desc", "br", "hr", "img", "td", "tr", "table"],
    ...["select", "option", "body", "html", "head", "tbody", "dt", "dd", "rt", "h1", "ul", "ol"],
    ...["<div>", "</div>", "<p>", "</p>", "<li>", "<b>", "</b>", "<script>", "</script>"],
    ...["<style>", "</style>", "<title>", "</title>", "<textarea>", "</textarea>", "<svg>"],
    ...["</svg>", "<svg/>", "<div/>", "<br/>", "<br>", "</br>", "<!--", "-->", "<!-->", "<!--->"],
    ...["<![CDATA[", "]]>", "<!", "<?", "</", "&lt;", "<mi>", "</mi>", "<foreignObject>"],
    ...["</foreignObject>", "<tmp>", "</xmp>", "<xmp>", "<scr", "ipt", "</scr", "<SCRIPT>"],
    ...["</SCRIPT >", "</script/>", "\u000f", "\u001c", "a=1", 'a="x>y"', "a='<div>'"],
    ...["<td>", "<tr>", "<table>", "<option>", "<select>", "<dt>", "<dd>", "<h1>", "<hr>"],
    ...["<input>", "<body>", "<html>", "<head>", "<colgroup>", "</td>", "</tr>", "</li>"],
    ...["<ul>", "</ul>", "<ul><li>"],
  ];

  test("20,000 generated bodies measure exactly as the parser's tree", () => {
    let seed = 20_261_118;
    const random = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 2 ** 32;
    };
    const mismatches: string[] = [];
    for (let run = 0; run < 20_000; run += 1) {
      let html = "";
      for (let count = 1 + Math.floor(random() * 60); count > 0; count -= 1) {
        html += TOKENS[Math.floor(random() * TOKENS.length)];
      }
      const scan = measureStructure(html);
      const tree = parsed(html);
      if (
        scan.exceeded ||
        scan.depth !== tree.depth ||
        scan.elements !== tree.elements ||
        scan.depthSum !== tree.depthSum
      ) {
        mismatches.push(
          `${JSON.stringify(html)}: ${JSON.stringify(scan)} vs ${JSON.stringify(tree)}`,
        );
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });
});

/** Each of these nests `count` deep in the parser although the tag text says otherwise. */
const DEEP_SHAPES: [string, (count: number) => string][] = [
  ["a self-closed div, which HTML does not close", (n) => repeat("<div/>", n)],
  ["a div followed by a closer that closes nothing", (n) => repeat("<div></x>", n)],
  ["an empty comment, then divs", (n) => `<!-->${repeat("<div>", n)}`],
  ["a three-dash empty comment, then divs", (n) => `<!--->${repeat("<div>", n)}`],
  ["body", (n) => repeat("<body>", n)],
  ["html", (n) => repeat("<html>", n)],
  ["head", (n) => repeat("<head>", n)],
  ["colgroup", (n) => repeat("<colgroup>", n)],
  ["a name that only starts like p", (n) => repeat("<p_>", n)],
  ["a name that only starts like li", (n) => repeat("<li.>", n)],
  ["a name that only starts like td", (n) => repeat("<td$>", n)],
  // Each group stays under the limit as the tag text reads, so only a scan that follows the tokenizer
  // sees the depth add up across groups.
  [
    "closers hidden in an attribute value",
    (n) => repeat(`${repeat("<div>", 100)}<b title="${repeat("</div>", 102)}">`, n / 100),
  ],
  [
    "closers hidden in a script",
    (n) => repeat(`${repeat("<div>", 100)}<script>${repeat("</div>", 100)}</script>`, n / 100),
  ],
  ["closers after a stray </p>", (n) => repeat("<div></p>", n)],
];

describe("the budget refuses what nests deep, however the tag text reads", () => {
  test.each(DEEP_SHAPES)("%s", (_name, shape) => {
    // The shape really is deep in the parser, so refusing it is right and not over-caution.
    expect(parsed(shape(2_000)).depth).toBeGreaterThan(MAX_NESTING_DEPTH);
    expect(measureStructure(shape(2_000)).exceeded).toBe(true);
    expect(isWithinStructureBudget(shape(2_000))).toBe(false);
  });

  test.each(DEEP_SHAPES)("%s compiles as text instead of overflowing", async (_name, shape) => {
    const body = shape(30_000);
    const started = performance.now();
    const html = compileArticleHtml(body, { baseUrl: BASE }).html;
    const { document } = await compileArticleDocument({ body, origin: "feed_html", baseUrl: BASE });
    const elapsed = performance.now() - started;

    expect(html).not.toMatch(/<(div|body|html|head|colgroup|li|td|b)\b/);
    expect(document).not.toBeNull();
    expect(elapsed).toBeLessThan(3_000);
  });

  test("nothing a body can hold makes the scan take more than a bounded time", () => {
    const hostile = [
      repeat("<div></x>", 400_000),
      repeat("<!--", 400_000),
      repeat("<a b=", 400_000),
      repeat("<script>", 200_000),
      `<div ${repeat("a ", 400_000)}>`,
    ];
    for (const body of hostile) {
      const started = performance.now();
      measureStructure(body);
      expect(performance.now() - started).toBeLessThan(1_000);
    }
  });
});

describe("what is not nesting is left alone", () => {
  test("markup inside raw text, comments and attribute values is text", () => {
    const text = [
      `<script>var t = "${repeat("<div>", 400)}";</script><p>x</p>`,
      `<textarea>${repeat("<div>", 400)}</textarea><p>x</p>`,
      `<style>${repeat("<div>", 400)}</style><p>x</p>`,
      `<!-- ${repeat("<div>", 400)} --><p>x</p>`,
      `<![CDATA[${repeat("<div>", 400)}]]><p>x</p>`,
      `<a title="${repeat("<div>", 400)}">x</a>`,
    ];
    for (const body of text) {
      expect(measureStructure(body).exceeded).toBe(false);
      expect(compileArticleHtml(body, { baseUrl: BASE }).html).toContain("x");
    }
  });

  test("the limits are inclusive and an element past them refuses the body", () => {
    expect(measureStructure(repeat("<div>", MAX_NESTING_DEPTH)).exceeded).toBe(false);
    expect(measureStructure(repeat("<div>", MAX_NESTING_DEPTH + 1)).exceeded).toBe(true);
    expect(measureStructure(repeat("<b>x</b>", MAX_ELEMENTS)).exceeded).toBe(false);
    expect(measureStructure(repeat("<b>x</b>", MAX_ELEMENTS + 1)).exceeded).toBe(true);
    expect(measureStructure(repeat("<svg>", 3) + repeat("<path/>", 5_000)).exceeded).toBe(false);
  });

  test("an article keeps its markup: nested tables, quotes, a full page, optional end tags", () => {
    const articles = [
      `${repeat("<table><tr><td>", 40)}x${repeat("</td></tr></table>", 40)}`,
      `${repeat("<blockquote><ul><li>", 30)}x${repeat("</li></ul></blockquote>", 30)}`,
      `<html><head><title>t</title></head><body>${repeat("<p>x</p>", 100)}</body></html>`,
      `<ul>${repeat("<li>item", 3_000)}</ul><table>${repeat("<tr><td>cell", 3_000)}</table>`,
      `<pre><code>${repeat('<span class="line"><span style="color:#fff">x</span></span>\n', 20_000)}</code></pre>`,
    ];
    for (const body of articles) {
      expect(measureStructure(body).exceeded).toBe(false);
      expect(compileArticleHtml(body, { baseUrl: BASE }).html).toContain("<");
    }
  });
});

describe("attributes", () => {
  const manyAttributes = (count: number) =>
    `<div ${Array.from({ length: count }, (_, index) => `a${index}`).join(" ")}>text</div>`;

  test("the scan counts every attribute name of a tag", () => {
    expect(measureStructure('<a href="x" title=y download>l</a>').attributes).toBe(3);
    expect(measureStructure("<img src=a alt='b'><br/><p class=c>x</p>").attributes).toBe(3);
  });

  test("one element with a few hundred attributes is as many as the budget allows", () => {
    expect(measureStructure(manyAttributes(MAX_ATTRIBUTES_PER_ELEMENT)).exceeded).toBe(false);
    expect(measureStructure(manyAttributes(MAX_ATTRIBUTES_PER_ELEMENT + 1)).exceeded).toBe(true);
    expect(compileArticleHtml(manyAttributes(100), { baseUrl: BASE }).html).toContain("<div");
  });

  test("the attributes of a whole body are bounded too", () => {
    const tag = `<p ${Array.from({ length: MAX_ATTRIBUTES_PER_ELEMENT }, (_, i) => `a${i}`).join(" ")}>x</p>`;
    expect(
      measureStructure(repeat(tag, Math.floor(MAX_ATTRIBUTES / MAX_ATTRIBUTES_PER_ELEMENT)))
        .exceeded,
    ).toBe(false);
    expect(
      measureStructure(repeat(tag, Math.ceil(MAX_ATTRIBUTES / MAX_ATTRIBUTES_PER_ELEMENT) + 1))
        .exceeded,
    ).toBe(true);
  });

  test("a tag with tens of thousands of attribute names compiles as text, quickly", () => {
    const started = performance.now();
    const html = compileArticleHtml(manyAttributes(40_000), { baseUrl: BASE }).html;
    const elapsed = performance.now() - started;

    expect(html).toBe("<p>text</p>");
    expect(elapsed).toBeLessThan(1_000);
  });

  test("attributes in quoted values, and repeated names, do not count as extra names", () => {
    const quoted = `<div title="${repeat("a b c ", 5_000)}" data-x='${repeat("d=e ", 5_000)}'>x</div>`;
    expect(measureStructure(quoted).attributes).toBe(2);
  });
});

describe("the depth sum bounds depth times elements", () => {
  test("255 levels under 40,000 elements is refused although each is within its own limit", () => {
    const body = `${repeat("<div>", 255)}${repeat("<p>x</p>", 40_000)}${repeat("</div>", 255)}`;
    const scan = measureStructure(body);

    expect(scan.depth).toBeLessThanOrEqual(MAX_NESTING_DEPTH);
    expect(scan.exceeded).toBe(true);
    const html = compileArticleHtml(body, { baseUrl: BASE }).html;
    expect(html).not.toContain("<div");
  });

  test("a deep body of a few thousand elements, and a flat body of fifty thousand, are kept", () => {
    const deep = `${repeat("<div>", 100)}${repeat("<p>x</p>", 5_000)}${repeat("</div>", 100)}`;
    expect(measureStructure(deep).depthSum).toBeLessThan(MAX_DEPTH_SUM);
    expect(compileArticleHtml(deep, { baseUrl: BASE }).html).toContain("<div>");

    expect(measureStructure(repeat("<p>x</p>", 49_000)).exceeded).toBe(false);
  });
});

describe("the tree is measured again after parsing", () => {
  test("a tree nested past the limit, or holding too many elements, is refused", () => {
    expect(isTreeWithinStructureBudget(parseArticleFragment(repeat("<div>", 2_000)).root)).toBe(
      false,
    );
    expect(isTreeWithinStructureBudget(parseArticleFragment(repeat("<b>x</b>", 60_000)).root)).toBe(
      false,
    );
    const wide = `${repeat("<div>", 255)}${repeat("<p>x</p>", 5_000)}`;
    expect(isTreeWithinStructureBudget(parseArticleFragment(wide).root)).toBe(false);
  });

  test("an ordinary tree passes, as a fragment root and as a whole document", () => {
    const { root, context } = parseArticleFragment(
      `<article>${repeat("<p>a <b>b</b></p>", 500)}</article>`,
    );

    expect(isTreeWithinStructureBudget(root)).toBe(true);
    expect(isTreeWithinStructureBudget(context.document)).toBe(true);
    expect(isTreeWithinStructureBudget(parseArticleFragment("").root)).toBe(true);
  });

  test("a whole document is measured through its html element", () => {
    const { context } = parseArticleFragment(repeat("<div>", 1_000));

    expect(isTreeWithinStructureBudget(context.document)).toBe(false);
  });
});
