// @vitest-environment jsdom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { readerDocumentSchema, type ReaderBlock } from "@kyomi/reader/document";
import { RenderDocument } from "@kyomi/reader/web";
import { documentOf, everyBlock, everyBlockDocument, text } from "./fixtures";
import { renderBlocks } from "./render";

describe("KDM fixtures", () => {
  test("the every-block fixture is valid KDM", () => {
    expect(readerDocumentSchema.safeParse(everyBlockDocument).success).toBe(true);
  });

  test("covers every block type in the schema", () => {
    const types = new Set(everyBlock.map((block) => block.type));
    for (const expected of [
      "paragraph",
      "heading",
      "list",
      "quote",
      "pullQuote",
      "divider",
      "code",
      "math",
      "table",
      "figure",
      "gallery",
      "video",
      "audio",
      "embed",
      "linkCard",
      "callout",
      "details",
      "definitionList",
      "mediaText",
      "html",
    ]) {
      expect(types.has(expected as ReaderBlock["type"])).toBe(true);
    }
  });

  test("renders the whole document without throwing", () => {
    const { body } = renderBlocks(everyBlock);
    expect(body.children.length).toBeGreaterThan(20);
  });
});

describe("inlines", () => {
  test("nested format nodes map to semantic elements", () => {
    const { body } = renderBlocks([everyBlock[0]!]);
    expect(body.querySelector("strong > em")?.textContent).toBe("and italic");
    for (const selector of [
      "s",
      "u",
      "ins",
      "sub",
      "sup",
      "mark",
      "small",
      "kbd",
      "cite",
      "q",
      "code",
      "br",
    ]) {
      expect(body.querySelector(selector), selector).toBeTruthy();
    }
    expect(body.querySelector("abbr")?.getAttribute("title")).toBe("HyperText Markup Language");
  });

  test("external links open in a new tab only when the preference is on", () => {
    const blocks: ReaderBlock[] = [
      {
        type: "paragraph",
        children: [{ type: "link", href: "https://example.org/a", children: [text("go")] }],
      },
    ];
    const on = renderBlocks(blocks, { openLinksInNewTab: true });
    expect(on.body.querySelector("a")?.getAttribute("target")).toBe("_blank");
    expect(on.body.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
    on.unmount();

    const off = renderBlocks(blocks, { openLinksInNewTab: false });
    expect(off.body.querySelector("a")?.hasAttribute("target")).toBe(false);
  });

  test("renders a non-http link href as plain text", () => {
    const blocks = [
      {
        type: "paragraph",
        children: [{ type: "link", href: "javascript:alert(1)", children: [text("bad")] }],
      },
    ] as unknown as ReaderBlock[];
    const { body } = renderBlocks(blocks);
    expect(body.querySelector("a")).toBeNull();
    expect(body.textContent).toBe("bad");
  });

  test("shows a preview card for external links when enabled", async () => {
    const { body } = renderBlocks(
      [
        {
          type: "paragraph",
          children: [{ type: "link", href: "https://example.org/a", children: [text("go")] }],
        },
      ],
      { showLinkPreviews: true },
    );
    const link = body.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.org/a");
    fireEvent.mouseEnter(link!);
    fireEvent.focus(link!);
    await waitFor(() => expect(document.body.textContent).toContain("example.org"));
  });

  test("fragment links and footnote refs target prefixed anchors and scroll", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as typeof window.matchMedia;
    render(<RenderDocument document={everyBlockDocument} showLinkPreviews={false} />);
    const body = document.body;

    const jump = [...body.querySelectorAll("a")].find((a) => a.textContent === "jump")!;
    expect(jump.getAttribute("href")).toBe("#kyomi-details");
    fireEvent.click(jump);
    expect(scrollIntoView).toHaveBeenCalled();
    expect(body.querySelector("#kyomi-details")).toBeTruthy();

    const ref = body.querySelector<HTMLAnchorElement>("sup[data-reader-footnote-ref] a")!;
    expect(ref.getAttribute("href")).toBe("#kyomi-note");
    expect(body.querySelector("#kyomi-note")?.textContent).toContain("The footnote text.");
    const back = body.querySelector<HTMLAnchorElement>("[data-reader-footnote-backref]")!;
    expect(back.getAttribute("href")).toBe(`#${ref.id}`);
  });

  test("inline images go through the image transport", () => {
    const transformImageUrl = (url: string) => `https://proxy.test/?u=${encodeURIComponent(url)}`;
    const { body } = renderBlocks([everyBlock[0]!], { transformImageUrl });
    expect(body.querySelector("img[data-reader-inline-img]")?.getAttribute("src")).toBe(
      `https://proxy.test/?u=${encodeURIComponent("https://cdn.example/emoji.png")}`,
    );
  });
});

describe("text blocks", () => {
  test("headings render at their level with prefixed anchors", () => {
    const { body } = renderBlocks([everyBlock[1]!, everyBlock[2]!]);
    const h2 = body.querySelector("h2")!;
    expect(h2.id).toBe("kyomi-details");
    expect(h2.querySelector("a[data-reader-heading-anchor]")?.getAttribute("href")).toBe(
      "#kyomi-details",
    );
    expect(body.querySelector("h3")?.id).toBe("");
    expect(body.querySelector("h3 a")).toBeNull();
  });

  test("lists keep order, start, nesting and task state", () => {
    const { body } = renderBlocks(everyBlock.slice(3, 5));
    const items = body.querySelectorAll("ul > li");
    expect(items[0]?.hasAttribute("data-kyomi-checked")).toBe(false);
    expect(items[1]?.getAttribute("data-kyomi-checked")).toBe("true");
    expect(items[2]?.getAttribute("data-kyomi-checked")).toBe("false");
    expect(body.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(body.querySelector("ol > li > ul > li")?.textContent).toBe("nested");
    // A lone paragraph is unwrapped so tight items keep inline rhythm.
    expect(items[0]?.querySelector("p")).toBeNull();
  });

  test("quotes cite their source and attribute the author", () => {
    const { body } = renderBlocks([everyBlock[5]!]);
    const quote = body.querySelector("blockquote")!;
    expect(quote.getAttribute("cite")).toBe("https://example.org/source");
    expect(quote.querySelector("footer")?.textContent).toBe("Someone");
  });

  test("pull quotes are marked for their own treatment", () => {
    const { body } = renderBlocks([everyBlock[6]!]);
    const quote = body.querySelector("blockquote[data-reader-pull-quote]")!;
    expect(quote.querySelector("p")?.textContent).toBe("Say it loud.");
    expect(quote.querySelector("footer")?.textContent).toBe("Editor");
  });

  test("divider, callout, details and definition list", () => {
    const { body } = renderBlocks(
      everyBlock.filter((block) =>
        ["divider", "callout", "details", "definitionList"].includes(block.type),
      ),
    );
    expect(body.querySelector("hr")).toBeTruthy();
    const callout = body.querySelector("aside[data-reader-callout='warning']")!;
    expect(callout.textContent).toContain("Heads up");
    expect(callout.textContent).toContain("Careful.");
    expect(body.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(body.querySelector("summary")?.textContent).toBe("More");
    expect(body.querySelector("dl > dt")?.textContent).toBe("Term");
    expect(body.querySelector("dl > dd")?.textContent).toBe("Meaning");
  });
});

describe("tables", () => {
  const table = everyBlock.find((block) => block.type === "table")!;

  test("scroll horizontally inside a focusable region", () => {
    const { body } = renderBlocks([table]);
    const region = body.querySelector<HTMLElement>("[data-reader-table]")!;
    expect(region.getAttribute("role")).toBe("region");
    expect(region.getAttribute("aria-label")).toBe("Scores");
    expect(region.tabIndex).toBe(0);
    expect(region.className).toContain("overflow-x-auto");
    expect(region.querySelector("table")).toBeTruthy();
  });

  test("cells hold blocks, with head, body, foot, spans and alignment", () => {
    const { body } = renderBlocks([table]);
    expect(body.querySelector("caption")?.textContent).toBe("Scores");
    expect(body.querySelector("thead th[scope='col']")?.textContent).toBe("Name");
    expect(body.querySelector("thead th[align='right']")?.textContent).toBe("Score");
    expect(body.querySelector("tbody th[scope='row']")?.textContent).toBe("Ada");
    expect(body.querySelector("tbody td[align='right'] ul li")?.textContent).toBe("bonus");
    expect(body.querySelector("tbody td[colspan='2']")?.textContent).toBe("merged");
    expect(body.querySelector("tfoot")?.textContent).toContain("Total");
  });
});

describe("code", () => {
  const code = everyBlock.find((block) => block.type === "code")!;

  test("renders stored dual-theme tokens without a highlighter", () => {
    const { body } = renderBlocks([code]);
    const wrapper = body.querySelector("[data-reader-code-block]")!;
    expect(wrapper.querySelector(".reader-code-filename")?.textContent).toBe("index.ts");
    expect(wrapper.querySelector("pre code")?.textContent).toBe("const a = 1;\nconst b = 2;");
    const token = wrapper.querySelector<HTMLElement>(".reader-token")!;
    expect(token.style.getPropertyValue("--rt-light")).toBe("#d73a49");
    expect(token.style.getPropertyValue("--rt-dark")).toBe("#ff7b72");
    expect(token.className).toContain("italic");
    expect(wrapper.querySelectorAll(".hljs-keyword, [class*='hljs-']")).toHaveLength(0);
  });

  test("marks highlighted lines", () => {
    const { body } = renderBlocks([code]);
    const lines = body.querySelectorAll(".reader-code-line");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.hasAttribute("data-highlighted")).toBe(false);
    expect(lines[1]?.hasAttribute("data-highlighted")).toBe(true);
  });

  test("mounts the vanilla DOM copy button and copies the exact source", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { body } = renderBlocks([code]);

    const button = await waitFor(() => {
      const found = body.querySelector<HTMLButtonElement>("button.reader-code-copy-button");
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.click(button);
    await waitFor(() => expect(button.classList.contains("is-copied")).toBe(true));
    expect(writeText).toHaveBeenCalledWith("const a = 1;\nconst b = 2;");
    expect(body.querySelectorAll("button.reader-code-copy-button")).toHaveLength(1);
  });

  test("falls back to plain lines when stored tokens disagree with the source", () => {
    const tampered = {
      ...code,
      value: "different",
      highlight: { ...(code as Extract<ReaderBlock, { type: "code" }>).highlight! },
    } as ReaderBlock;
    const { body } = renderBlocks([tampered]);
    expect(body.querySelector("pre code")?.textContent).toBe("different");
    expect(body.querySelector(".reader-token")).toBeNull();
  });

  test("ignores token colours that are not plain hex", () => {
    const block = {
      type: "code",
      value: "x",
      language: null,
      languageSource: "none",
      label: "Plain text",
      highlight: {
        engine: "t",
        styles: [{}, { light: "red; background:url(x)" }],
        lines: [[["x", 1]]],
      },
    } as unknown as ReaderBlock;
    const { body } = renderBlocks([block]);
    expect(
      body.querySelector<HTMLElement>(".reader-token")?.getAttribute("style") ?? "",
    ).not.toContain("url");
  });
});

describe("math", () => {
  test("injects the stored KaTeX HTML for block and inline math", () => {
    const { body } = renderBlocks([
      everyBlock.find((block) => block.type === "math")!,
      {
        type: "paragraph",
        children: [{ type: "math", tex: "a", rendered: '<span class="katex">a</span>' }],
      },
    ]);
    expect(body.querySelector("div[data-reader-math='block'] .katex-display")).toBeTruthy();
    expect(body.querySelector("p span[data-reader-math='inline'] .katex")).toBeTruthy();
  });

  test("refuses rendered HTML that carries active content and shows the TeX instead", () => {
    const { body } = renderBlocks([
      {
        type: "math",
        tex: "x",
        rendered: '<img src=x onerror="alert(1)"><script>alert(1)</script>',
      },
    ]);
    expect(body.querySelector("script")).toBeNull();
    expect(body.querySelector("img")).toBeNull();
    expect(body.querySelector("[data-reader-math] code")?.textContent).toBe("x");
  });

  test("sanitizes publisher MathML when there is no rendered form", async () => {
    const { body } = renderBlocks([
      { type: "math", mathml: '<math><mi>x</mi><mi onclick="alert(1)">y</mi></math>' },
    ]);
    await waitFor(() => expect(body.querySelector("math")).toBeTruthy());
    expect(body.querySelector("[onclick]")).toBeNull();
  });
});

describe("html escape hatch", () => {
  test("renders through the sanitized HTML path", async () => {
    const { body } = renderBlocks([
      {
        type: "html",
        html: '<p>Safe <b>text</b></p><img src="x" onerror="alert(1)"><script>alert(1)</script>',
        reason: "test",
      },
    ]);
    await waitFor(() =>
      expect(body.querySelector("[data-reader-html-block] b")?.textContent).toBe("text"),
    );
    expect(body.querySelector("script")).toBeNull();
    expect(body.querySelector("[onerror]")).toBeNull();
  });
});

describe("document root", () => {
  test("uses the HTML reader's root so preferences apply through the same CSS path", () => {
    const { container } = render(
      <div className="reader-content" style={{ ["--reader-font-size" as string]: "19px" }}>
        <RenderDocument
          document={documentOf([{ type: "paragraph", children: [text("Hi")] }], {
            meta: { ...documentOf([]).meta, direction: "rtl", language: "ar" },
          })}
        />
      </div>,
    );
    const body = container.querySelector<HTMLElement>(".reader-content > .article-body")!;
    expect(body.getAttribute("data-reader-layout-mode")).toBe("fidelity");
    expect(body.getAttribute("dir")).toBe("rtl");
    expect(body.getAttribute("lang")).toBe("ar");
    // No inline sizing: the font size reaches the text purely through `--reader-font-size`.
    expect(body.getAttribute("style")).toBeNull();
  });
});
