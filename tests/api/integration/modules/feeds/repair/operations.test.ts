import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { PgDialect } from "drizzle-orm/pg-core";
import { feedItems, feeds } from "@kyomi/db";
import {
  formatUrlRepairReport,
  repairStoredUrls,
  type UrlRepairOptions,
} from "@modules/feeds/repair/operations";
import { fakeDb, recordingLogger } from "@api-tests/support/layers";

const SECRET = "hunter2";
const CREDENTIALED = `https://admin:${SECRET}@evil.example/private/feed.xml?token=${SECRET}`;

type FeedRow = {
  id: string;
  url: string;
  link: string | null;
  siteUrl: string | null;
  canonicalFeedUrl: string | null;
  discoveredFromUrl: string | null;
  faviconUrl: string | null;
  faviconSource?: string | null;
};
type ItemRow = {
  id: string;
  feedId: string;
  link: string;
  imageUrl: string | null;
};

const feedRow = (id: string, over: Partial<FeedRow> = {}): FeedRow => ({
  id,
  url: `https://${id}.example.com/rss.xml`,
  link: `https://${id}.example.com/`,
  siteUrl: `https://${id}.example.com/`,
  canonicalFeedUrl: `https://${id}.example.com/rss.xml`,
  discoveredFromUrl: null,
  faviconUrl: `https://${id}.example.com/favicon.ico`,
  faviconSource: "html_link",
  ...over,
});

const itemRow = (id: string, feedId: string, over: Partial<ItemRow> = {}): ItemRow => ({
  id,
  feedId,
  link: `https://${feedId}.example.com/posts/${id}`,
  imageUrl: null,
  ...over,
});

type Read = { table: "feeds" | "feed_items"; after: string | null; limit: number };
type Write = { table: "feeds" | "feed_items"; id: string; set: Record<string, unknown> };

const dialect = new PgDialect();
const paramsOf = (condition: unknown) =>
  condition === undefined ? [] : dialect.sqlToQuery(condition as never).params;

/**
 * An in-memory `feeds` and `feed_items` behind the Drizzle calls the repair makes. The keyset
 * predicate is read from the SQL the code built (its bound cursor), so paging is exercised for
 * real; an update is applied to the rows so a second run sees the repaired data.
 */
function fakeTables(data: { feeds: FeedRow[]; items: ItemRow[] }) {
  const reads: Read[] = [];
  const writes: Write[] = [];
  const page = <Row extends { id: string }>(rows: Row[], after: string | null, limit: number) =>
    [...rows]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .filter((row) => after === null || row.id > after)
      .slice(0, limit);

  const query = (table: "feeds" | "feed_items") => {
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      where: (condition: unknown) => {
        const [after] = paramsOf(condition);
        reads.push({ table, after: (after as string | undefined) ?? null, limit: 0 });
        return chain;
      },
      orderBy: () => chain,
      limit: (limit: number) => {
        const read = reads[reads.length - 1]!;
        read.limit = limit;
        if (table === "feeds") {
          return Promise.resolve(page(data.feeds, read.after, limit));
        }
        return Promise.resolve(
          page(data.items, read.after, limit).map((row) => {
            const parent = data.feeds.find((candidate) => candidate.id === row.feedId)!;
            return { ...row, feedUrl: parent.url, feedLink: parent.link };
          }),
        );
      },
    };
    return chain;
  };

  const layer = fakeDb({
    select: (fields: Record<string, unknown>) =>
      query("feedUrl" in fields ? "feed_items" : "feeds"),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          const [id] = paramsOf(condition) as [string];
          const name = table === feeds ? "feeds" : "feed_items";
          if (table !== feeds && table !== feedItems) {
            throw new Error("unexpected table");
          }
          writes.push({ table: name, id, set });
          const target = (name === "feeds" ? data.feeds : data.items).find((row) => row.id === id)!;
          const { updatedAt: _ignored, ...columns } = set;
          Object.assign(target, columns);
          return Promise.resolve();
        },
      }),
    }),
  });
  return { layer, reads, writes };
}

const options = (over: Partial<UrlRepairOptions> = {}): UrlRepairOptions => ({
  apply: false,
  batchSize: 2,
  sleepMs: 0,
  ...over,
});

async function run(tables: ReturnType<typeof fakeTables>, opts: UrlRepairOptions) {
  const logs = recordingLogger();
  const report = await Effect.runPromise(
    repairStoredUrls(opts).pipe(Effect.provide(Layer.mergeAll(tables.layer, logs.layer))),
  );
  return { report, logs: logs.entries };
}

/** Three feeds (one clean, one hostile, one whose own url carries a login) and their items. */
function dataset() {
  return {
    feeds: [
      feedRow("feed-a"),
      feedRow("feed-b", {
        link: "javascript:alert(1)",
        siteUrl: `https://u:${SECRET}@b.example.com/`,
        faviconUrl: "data:image/png;base64,AAAA",
      }),
      feedRow("feed-c", { url: CREDENTIALED, canonicalFeedUrl: CREDENTIALED, link: null }),
    ],
    items: [
      itemRow("item-1", "feed-a"),
      itemRow("item-2", "feed-a", { link: "javascript:alert(1)", imageUrl: "data:text/html,x" }),
      itemRow("item-3", "feed-b", { link: `https://u:${SECRET}@b.example.com/p` }),
      itemRow("item-4", "feed-b", { imageUrl: "https://feed-b.example.com/a.png" }),
      itemRow("item-5", "feed-c", { link: "ftp://evil.example/x" }),
    ],
  };
}

describe("repairStoredUrls", () => {
  test("a dry run counts what it would change and writes nothing", async () => {
    const tables = fakeTables(dataset());
    const { report } = await run(tables, options());

    expect(tables.writes).toEqual([]);
    expect(report).toMatchObject({
      apply: false,
      feeds: { scanned: 3, faviconsCleared: 1, linkColumnsCleared: 2 },
      feedItems: { scanned: 5, linksRepaired: 2, linksUnrepairable: 1, imagesCleared: 1 },
      changedFeedIds: ["feed-b", "feed-c"],
    });
  });

  test("pages both tables by keyset, one short page ending each scan", async () => {
    const tables = fakeTables(dataset());
    await run(tables, options());

    expect(tables.reads).toEqual([
      { table: "feeds", after: null, limit: 2 },
      { table: "feeds", after: "feed-b", limit: 2 },
      { table: "feed_items", after: null, limit: 2 },
      { table: "feed_items", after: "item-2", limit: 2 },
      { table: "feed_items", after: "item-4", limit: 2 },
    ]);
  });

  test("a full last page costs one extra read that finds nothing", async () => {
    const tables = fakeTables({ feeds: [feedRow("feed-a"), feedRow("feed-b")], items: [] });
    const { report } = await run(tables, options());

    expect(tables.reads.filter((read) => read.table === "feeds")).toEqual([
      { table: "feeds", after: null, limit: 2 },
      { table: "feeds", after: "feed-b", limit: 2 },
    ]);
    expect(report.feeds.scanned).toBe(2);
  });

  test("apply updates only the rows that need it, by id", async () => {
    const tables = fakeTables(dataset());
    const { report } = await run(tables, options({ apply: true }));

    expect(report.apply).toBe(true);
    expect(tables.writes.map(({ table, id, set }) => [table, id, Object.keys(set).sort()])).toEqual(
      [
        ["feeds", "feed-b", ["faviconSource", "faviconUrl", "link", "siteUrl", "updatedAt"]],
        ["feeds", "feed-c", ["canonicalFeedUrl", "updatedAt"]],
        ["feed_items", "item-2", ["imageUrl", "link", "updatedAt"]],
        ["feed_items", "item-3", ["link", "updatedAt"]],
      ],
    );
    const byId = Object.fromEntries(tables.writes.map((write) => [write.id, write.set]));
    expect(byId["feed-b"]).toMatchObject({
      link: null,
      siteUrl: null,
      faviconUrl: null,
      faviconSource: null,
    });
    expect(byId["feed-b"]?.updatedAt).toBeInstanceOf(Date);
    // A bad link becomes the feed's own link, or its URL when that link is itself bad (feed-b's
    // is `javascript:`); the item whose feed offers neither is left in place.
    expect(byId["item-2"]).toMatchObject({ link: "https://feed-a.example.com/", imageUrl: null });
    expect(byId["item-3"]).toMatchObject({ link: "https://feed-b.example.com/rss.xml" });
    expect(byId["item-5"]).toBeUndefined();
  });

  test("a feed's own url is reported, never rewritten", async () => {
    const tables = fakeTables(dataset());
    const { report } = await run(tables, options({ apply: true }));

    expect(report.unsafeFeedUrls).toEqual([
      { feedId: "feed-c", reason: "credentials", host: "evil.example" },
    ]);
    expect(tables.writes.some((write) => "url" in write.set)).toBe(false);
  });

  test("an item of a feed with a login in its url takes the feed's link when it has a clean one", async () => {
    const data = dataset();
    data.feeds[2]!.link = "https://c.example.com/";
    const tables = fakeTables(data);
    const { report } = await run(tables, options({ apply: true }));

    expect(report.feedItems.linksUnrepairable).toBe(0);
    expect(tables.writes.find((write) => write.id === "item-5")?.set).toMatchObject({
      link: "https://c.example.com/",
    });
  });

  test("is idempotent: a second run over the repaired rows changes nothing", async () => {
    const tables = fakeTables(dataset());
    await run(tables, options({ apply: true }));
    const firstRunWrites = tables.writes.length;

    const { report } = await run(tables, options({ apply: true }));
    expect(tables.writes).toHaveLength(firstRunWrites);
    expect(report).toMatchObject({
      feeds: { faviconsCleared: 0, linkColumnsCleared: 0 },
      feedItems: { linksRepaired: 0, imagesCleared: 0 },
      changedFeedIds: [],
    });
  });

  test("an acceptable dataset is left entirely alone", async () => {
    const tables = fakeTables({
      feeds: [feedRow("feed-a"), feedRow("feed-b")],
      items: [itemRow("item-1", "feed-a"), itemRow("item-2", "feed-b", { link: "" })],
    });
    const { report } = await run(tables, options({ apply: true }));

    expect(tables.writes).toEqual([]);
    expect(report.changedFeedIds).toEqual([]);
    expect(report.unsafeFeedUrls).toEqual([]);
  });

  test("neither the report, its text nor the logs carry a username, password or full URL", async () => {
    for (const apply of [false, true]) {
      const tables = fakeTables(dataset());
      const { report, logs } = await run(tables, options({ apply }));
      const printed = [
        JSON.stringify(report),
        ...formatUrlRepairReport(report),
        JSON.stringify(logs),
      ].join("\n");

      for (const leaked of [SECRET, "admin", "token=", "private/feed.xml", "https://", "http://"]) {
        expect(printed).not.toContain(leaked);
      }
      expect(printed).toContain("feed-c");
      expect(printed).toContain("evil.example");
    }
  });
});

describe("formatUrlRepairReport", () => {
  test("labels a dry run and an applied run, and lists the feeds to re-index", async () => {
    const dry = await run(fakeTables(dataset()), options());
    const applied = await run(fakeTables(dataset()), options({ apply: true }));

    const dryLines = formatUrlRepairReport(dry.report);
    expect(dryLines[0]).toStartWith("DRY RUN");
    expect(dryLines.join("\n")).toContain("would change");
    const appliedLines = formatUrlRepairReport(applied.report);
    expect(appliedLines[0]).toBe("APPLIED");
    expect(appliedLines.join("\n")).not.toContain("would change");
    expect(appliedLines).toContain("  feed-b");
    expect(appliedLines).toContain("  feed-c");
    expect(appliedLines).toContain("  feed feed-c reason credentials host evil.example");
  });
});
