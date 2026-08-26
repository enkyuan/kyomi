import { db, pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/script-preflight";
import { feeds, opmlImportItems, opmlImports, users } from "@kyomi/db";
import { count, eq, inArray } from "drizzle-orm";
import {
  claimOpmlPreparation,
  createOpmlImport,
  finalizeOpmlImportPreparation,
  insertOpmlImportItems,
  recordOpmlImportMaterialized,
} from "@modules/opml/store";
import { matchKnownFeedsForImport, subscribeKnownOpmlItems } from "@modules/opml/known-feeds";
import { parseOpmlDocument } from "@modules/opml/parse";
import { OPML_MATERIALIZE_CHUNK_SIZE } from "@modules/opml/constants";

/**
 * bun run bench:import -- --feeds 50000 --known-ratio 0.5
 * Drives the real prepare pipeline (parse -> materialize -> match-known -> subscribe-known loop
 * -> finalize) against a real dev Postgres, using a throwaway user/feeds that are deleted (via
 * FK cascade on the user row) once the run completes, whether it succeeds or throws.
 */

type BenchArgs = { feeds: number; knownRatio: number };

function parseArgs(argv: string[]): BenchArgs {
  const feedsArg = valueAfter(argv, "--feeds");
  const knownRatioArg = valueAfter(argv, "--known-ratio");
  const feedCount = feedsArg ? Number(feedsArg) : 1_000;
  const knownRatio = knownRatioArg ? Number(knownRatioArg) : 0;
  if (!Number.isFinite(feedCount) || feedCount <= 0) {
    throw new Error("--feeds must be a positive number");
  }
  if (!Number.isFinite(knownRatio) || knownRatio < 0 || knownRatio > 1) {
    throw new Error("--known-ratio must be between 0 and 1");
  }
  return { feeds: feedCount, knownRatio };
}

function valueAfter(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  return index === -1 ? null : (argv[index + 1] ?? null);
}

function buildRepresentativeOpml(feedCount: number, knownUrls: string[]): string {
  const outlines = Array.from({ length: feedCount }, (_, index) => {
    const url =
      knownUrls[index] ?? `https://example.com/feed/${index}?key=value&note=representative`;
    const title = `Representative feed title number ${index} with realistic length padding`;
    return `<outline text="${title}" xmlUrl="${url}"/>`;
  }).join("");
  return `<?xml version="1.0"?><opml version="2.0"><body>${outlines}</body></opml>`;
}

async function main() {
  await assertApiDatabaseReady({ commandName: "bench:import" });

  const args = parseArgs(process.argv.slice(2));
  const knownFeedCount = Math.round(args.feeds * args.knownRatio);
  const userId = crypto.randomUUID();
  const knownFeedIds: string[] = [];

  try {
    await db.insert(users).values({
      id: userId,
      name: "import-bench",
      email: `import-bench-${userId}@bench.local`,
    });

    const knownUrls: string[] = [];
    for (let i = 0; i < knownFeedCount; i += 1) {
      const url = `https://example.com/known-feed/${i}?key=value`;
      knownUrls.push(url);
      knownFeedIds.push(`bench-feed-${userId}-${i}`);
    }
    for (const chunkStart of range(0, knownFeedIds.length, OPML_MATERIALIZE_CHUNK_SIZE)) {
      const chunkIds = knownFeedIds.slice(chunkStart, chunkStart + OPML_MATERIALIZE_CHUNK_SIZE);
      const chunkUrls = knownUrls.slice(chunkStart, chunkStart + OPML_MATERIALIZE_CHUNK_SIZE);
      if (chunkIds.length === 0) {
        continue;
      }
      await db.insert(feeds).values(
        chunkIds.map((id, offset) => ({
          id,
          url: chunkUrls[offset] as string,
          title: `Bench known feed ${offset}`,
        })),
      );
    }

    const xml = buildRepresentativeOpml(args.feeds, knownUrls);
    const sourceBytes = Buffer.byteLength(xml, "utf8");

    const created = await createOpmlImport(db, {
      userId,
      filename: "bench.opml",
      sourceXml: xml,
    });

    const parseStartedAt = performance.now();
    const claimed = await claimOpmlPreparation(db, created.id);
    if (!claimed) {
      throw new Error("Bench import could not be claimed for preparation");
    }
    const document = parseOpmlDocument(claimed.sourceXml);
    const parseMs = performance.now() - parseStartedAt;

    const materializeStartedAt = performance.now();
    const rowsInserted = await insertOpmlImportItems(db, created.id, document.feeds, new Map());
    await recordOpmlImportMaterialized(db, created.id, {
      totalItems: document.feeds.length,
      opmlTitle: document.opmlTitle,
      opmlAuthor: document.opmlAuthor,
    });
    const materializeMs = performance.now() - materializeStartedAt;

    const knownCompletionStartedAt = performance.now();
    let rowsDispatched = 0;
    await matchKnownFeedsForImport(db, created.id);
    while (true) {
      const completion = await subscribeKnownOpmlItems(db, created.id, userId);
      rowsDispatched += completion.processed;
      if (completion.processed === 0) {
        break;
      }
      await matchKnownFeedsForImport(db, created.id);
    }
    await finalizeOpmlImportPreparation(db, created.id);
    const knownCompletionMs = performance.now() - knownCompletionStartedAt;

    const [countedRow] = await db
      .select({ total: count() })
      .from(opmlImportItems)
      .where(eq(opmlImportItems.importId, created.id));
    const [finalImport] = await db
      .select()
      .from(opmlImports)
      .where(eq(opmlImports.id, created.id))
      .limit(1);

    const expectedCompleted =
      (finalImport?.subscribedItems ?? 0) + (finalImport?.alreadySubscribedItems ?? 0);
    const counterMismatch =
      countedRow?.total !== document.feeds.length || expectedCompleted !== knownFeedCount;

    const result = {
      feeds: args.feeds,
      knownRatio: args.knownRatio,
      sourceBytes,
      parseMs: Math.round(parseMs),
      materializeMs: Math.round(materializeMs),
      knownCompletionMs: Math.round(knownCompletionMs),
      peakRssBytes: process.memoryUsage().rss,
      rowsInserted,
      rowsDispatched,
      counterMismatch,
    };
    console.log(JSON.stringify(result));
  } finally {
    // Deleting the user cascades to opml_imports, opml_import_items, and feed_subscriptions;
    // bench-created feeds are global rows in the shared feeds table, deleted by exact id in
    // chunks -- a LIKE-prefix scan here does a full sequential scan on a catalog-sized table.
    await db.delete(users).where(eq(users.id, userId));
    for (const chunkStart of range(0, knownFeedIds.length, OPML_MATERIALIZE_CHUNK_SIZE)) {
      const chunkIds = knownFeedIds.slice(chunkStart, chunkStart + OPML_MATERIALIZE_CHUNK_SIZE);
      if (chunkIds.length > 0) {
        await db.delete(feeds).where(inArray(feeds.id, chunkIds));
      }
    }
    await pool.end();
  }
}

function* range(start: number, end: number, step: number): Generator<number> {
  for (let i = start; i < end; i += step) {
    yield i;
  }
}

await main();
