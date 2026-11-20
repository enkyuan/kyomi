// Value: protects=the reader bar offers the five tools in order, reflects the article's saved and reader-view state, and switching reader view swaps the body without another request;
//   fails_when=a tool is dropped or reordered, a saved article keeps the outline bookmark, reader view is offered with no extracted body, or the switch keeps the server's body;
//   why_new=the reader's bar was new, and its state is derived from the article DTO in one place;
//   seam=none;
//   no_claim=green does not prove the native bar draws these tools or that a press reaches them.
import { describe, expect, test } from "bun:test";
import type { ReaderArticle } from "../../../../../../apps/mobile/src/modules/reader/lib/article";
import {
  buildReaderTools,
  hasExtractedContent,
  isReaderToolKey,
  withReaderMode,
} from "../../../../../../apps/mobile/src/modules/reader/lib/toolbar";

const ORIGINAL = { kind: "html", html: "<p>original</p>" };
const EXTRACTED = { kind: "html", html: "<p>extracted</p>" };

function article(overrides: Record<string, unknown> = {}, extracted: unknown = EXTRACTED) {
  return {
    id: "article-1",
    isSaved: false,
    reader: {
      activeMode: "original",
      extracted: { available: extracted !== null, content: extracted },
      original: { available: true, content: ORIGINAL },
      selected: ORIGINAL,
    },
    ...overrides,
  } as unknown as ReaderArticle;
}

describe("buildReaderTools", () => {
  test("lists save, share, reader view, text size and open original, in that order", () => {
    expect(buildReaderTools(article()).map((tool) => tool.key)).toEqual([
      "save",
      "share",
      "mode",
      "textSize",
      "original",
    ]);
  });

  test("disables every tool while the article loads, so the bar can take the reader's shape early", () => {
    const tools = buildReaderTools(undefined);

    expect(tools).toHaveLength(5);
    expect(tools.every((tool) => tool.disabled)).toBe(true);
  });

  test("marks a saved article and says what the next press does", () => {
    const [save] = buildReaderTools(article({ isSaved: true }));

    expect(save).toMatchObject({ label: "Remove from saved", selected: true });
    expect(save?.selectedIcon).toBeDefined();
    expect(save?.selectedIcon).not.toEqual(save?.icon);
    expect(buildReaderTools(article())[0]).toMatchObject({
      label: "Save article",
      selected: false,
    });
  });

  test("offers reader view only when there is an extracted body, and marks it while shown", () => {
    const mode = (tools: ReturnType<typeof buildReaderTools>) =>
      tools.find((tool) => tool.key === "mode");

    expect(mode(buildReaderTools(article(undefined, null)))?.disabled).toBe(true);
    expect(mode(buildReaderTools(article()))).toMatchObject({ disabled: false, selected: false });
    const shown = withReaderMode(article(), "extracted");
    expect(mode(buildReaderTools(shown))?.selected).toBe(true);
  });
});

describe("withReaderMode", () => {
  test("selects the body of the chosen view", () => {
    const shown = withReaderMode(article(), "extracted");

    expect(shown.reader.activeMode).toBe("extracted");
    expect(shown.reader.selected).toBe(EXTRACTED as never);
    expect(withReaderMode(shown, "original").reader.selected).toBe(ORIGINAL as never);
  });

  test("keeps the server's body when the other view has none", () => {
    const base = article(undefined, null);

    expect(hasExtractedContent(base)).toBe(false);
    expect(withReaderMode(base, "extracted")).toBe(base);
  });
});

describe("isReaderToolKey", () => {
  test("accepts the bar's tools and nothing else", () => {
    expect(isReaderToolKey("textSize")).toBe(true);
    expect(isReaderToolKey("translate")).toBe(false);
  });
});
