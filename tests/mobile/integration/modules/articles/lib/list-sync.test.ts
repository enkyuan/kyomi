import { describe, expect, test } from "bun:test";
import {
  createListSync,
  diffPaging,
  diffRows,
} from "../../../../../../apps/mobile/src/modules/articles/lib/list-sync";
import type { ArticleListRow } from "../../../../../../apps/mobile/modules/article-list";

const row = (id: string, overrides: Partial<ArticleListRow> = {}): ArticleListRow => ({
  faviconUrls: [`https://example.com/${id}.ico`],
  feedTitle: "Example",
  id,
  kind: "article",
  sourceLabel: "example.com",
  timeLabel: "1h",
  title: `Article ${id}`,
  ...overrides,
});

describe("diffRows", () => {
  test("resets a list that holds no rows yet", () => {
    const next = [row("a"), row("b")];

    expect(diffRows(null, next, 3)).toEqual([{ epoch: 3, rows: next, type: "reset" }]);
  });

  test("sends nothing for the rows the list already holds", () => {
    const rows = [row("a")];

    expect(diffRows(rows, rows, 1)).toEqual([]);
  });

  test("appends only the new page", () => {
    const first = [row("a"), row("b")];
    const second = row("c");

    expect(diffRows(first, [...first, second], 1)).toEqual([{ rows: [second], type: "append" }]);
  });

  test("appends every row to a list that is empty", () => {
    const next = [row("a")];

    expect(diffRows([], next, 1)).toEqual([{ rows: next, type: "append" }]);
  });

  test("updates only the row whose content changed", () => {
    const [a, b] = [row("a"), row("b")];
    const savedB = row("b", { isSaved: true });

    expect(diffRows([a, b], [a, savedB], 1)).toEqual([{ rows: [savedB], type: "update" }]);
  });

  test("treats a rebuilt row with the same content as unchanged", () => {
    const [a, b] = [row("a"), row("b")];

    expect(diffRows([a, b], [a, row("b")], 1)).toEqual([]);
  });

  test("notices a changed favicon candidate list", () => {
    const a = row("a");
    const moved = row("a", { faviconUrls: ["https://example.com/other.ico"] });

    expect(diffRows([a], [moved], 1)).toEqual([{ rows: [moved], type: "update" }]);
  });

  test("removes a hidden row without touching the others", () => {
    const [a, b, c] = [row("a"), row("b"), row("c")];

    expect(diffRows([a, b, c], [a, c], 1)).toEqual([{ ids: ["b"], type: "remove" }]);
  });

  test("combines a removal, an edit and a new page in one batch, in that order", () => {
    const [a, b, c] = [row("a"), row("b"), row("c")];
    const savedC = row("c", { isSaved: true });
    const d = row("d");

    expect(diffRows([a, b, c], [a, savedC, d], 1)).toEqual([
      { ids: ["b"], type: "remove" },
      { rows: [savedC], type: "update" },
      { rows: [d], type: "append" },
    ]);
  });

  test("resets when a row is inserted before rows the list holds", () => {
    const [a, b] = [row("a"), row("b")];
    const fresh = row("fresh");

    expect(diffRows([a, b], [fresh, a, b], 2)).toEqual([
      { epoch: 2, rows: [fresh, a, b], type: "reset" },
    ]);
  });

  test("resets when rows swap places", () => {
    const [a, b] = [row("a"), row("b")];

    expect(diffRows([a, b], [b, a], 2)).toEqual([{ epoch: 2, rows: [b, a], type: "reset" }]);
  });

  test("resets for another data set", () => {
    const next = [row("x"), row("y")];

    expect(diffRows([row("a"), row("b")], next, 4)).toEqual([
      { epoch: 4, rows: next, type: "reset" },
    ]);
  });

  test("resets when an id repeats, which the native list cannot show twice", () => {
    const a = row("a");

    expect(diffRows([a], [a, row("a", { title: "again" })], 2)).toEqual([
      { epoch: 2, rows: expect.any(Array), type: "reset" },
    ]);
  });
});

describe("diffPaging", () => {
  const paging = { hasMore: true, isLoadingMore: false, pageCount: 1 };

  test("sends the paging state to a list that has none", () => {
    expect(diffPaging(null, paging)).toEqual({
      hasMore: true,
      isLoadingMore: false,
      pageCount: 1,
      type: "paging",
    });
  });

  test("sends nothing while paging is unchanged, even for a rebuilt object", () => {
    expect(diffPaging(paging, { ...paging })).toBeNull();
  });

  test("reports a fetch starting", () => {
    expect(diffPaging(paging, { ...paging, isLoadingMore: true })).toEqual({
      hasMore: true,
      isLoadingMore: true,
      pageCount: 1,
      type: "paging",
    });
  });

  test("reports a page that arrived, which re-arms the end trigger even if no row shows", () => {
    const loading = { ...paging, isLoadingMore: true };

    expect(diffPaging(loading, { hasMore: true, isLoadingMore: false, pageCount: 2 })).toEqual({
      hasMore: true,
      isLoadingMore: false,
      pageCount: 2,
      type: "paging",
    });
  });

  test("reports the last page", () => {
    expect(diffPaging(paging, { ...paging, hasMore: false })).toMatchObject({ hasMore: false });
  });
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("native list delivery", () => {
  test("serializes batches and coalesces updates received while a send is pending", async () => {
    const sent: unknown[][] = [];
    let release: (() => void) | undefined;
    const sync = createListSync(
      async (payload) => {
        sent.push(JSON.parse(payload));
        if (sent.length === 1)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
      },
      () => {},
    );
    const a = row("a");
    sync.update([a]);
    sync.update([a, row("b")]);
    sync.update([a, row("b"), row("c")]);
    expect(sent).toHaveLength(1);
    release?.();
    await tick();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual([{ type: "append", rows: [row("b"), row("c")] }]);
    sync.dispose();
  });

  test("recovers a rejected delivery with a full reset, without an unhandled rejection", async () => {
    const sent: { type: string }[][] = [];
    const errors: unknown[] = [];
    const sync = createListSync(
      async (payload) => {
        sent.push(JSON.parse(payload));
        if (sent.length === 1) throw new Error("view unavailable");
      },
      (error) => errors.push(error),
    );
    sync.update([row("a")]);
    await tick();
    expect(errors).toHaveLength(1);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.[0]?.type).toBe("reset");
    sync.update([row("a"), row("b")]);
    await tick();
    expect(sent[2]?.[0]?.type).toBe("append");
    sync.dispose();
  });

  test("bounds retries when the native view continues rejecting", async () => {
    let calls = 0;
    const sync = createListSync(
      async () => {
        calls++;
        throw new Error("gone");
      },
      () => {},
    );
    sync.update([row("a")]);
    await tick();
    expect(calls).toBe(2);
    sync.dispose();
  });

  test("resets and scrolls to top when filter changes even when IDs overlap", async () => {
    const sent: unknown[][] = [];
    const sync = createListSync(
      async (payload) => {
        sent.push(JSON.parse(payload));
      },
      () => {},
    );
    const rows = [row("a")];
    sync.update(rows, undefined, "all");
    await tick();
    sync.update(rows, undefined, "saved");
    await tick();
    expect(sent[1]?.[0]).toMatchObject({ type: "reset", scrollToTop: true, rows });
    sync.dispose();
  });

  test("retains a dataset change across a rejected reset", async () => {
    const sent: unknown[][] = [];
    const sync = createListSync(
      async (payload) => {
        sent.push(JSON.parse(payload));
        if (sent.length === 2) throw new Error("temporary failure");
      },
      () => {},
    );
    sync.update([row("a")], undefined, "all");
    await tick();
    sync.update([row("a")], undefined, "saved");
    await tick();
    expect(sent[2]?.[0]).toMatchObject({ type: "reset", scrollToTop: true });
    sync.dispose();
  });

  test("clears paging when switching to an unpaged dataset", async () => {
    const sent: unknown[][] = [];
    const sync = createListSync(
      async (payload) => {
        sent.push(JSON.parse(payload));
      },
      () => {},
    );
    const rows = [row("a")];
    sync.update(rows, { hasMore: true, isLoadingMore: true, pageCount: 1 });
    await tick();
    sync.update(rows);
    await tick();
    expect(sent[1]).toEqual([
      { type: "paging", hasMore: false, isLoadingMore: false, pageCount: 0 },
    ]);
    sync.dispose();
  });

  test("stops queued work when a view unmounts", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const sync = createListSync(
      async () => {
        calls++;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
      () => {},
    );
    sync.update([row("a")]);
    sync.update([row("b")]);
    sync.dispose();
    release?.();
    await tick();
    expect(calls).toBe(1);
  });
});
