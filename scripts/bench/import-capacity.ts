import { Console, Data, Effect } from "effect";
import { feeds, opmlImportItems, opmlImports, users } from "@kyomi/db";
import { count, eq, inArray } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { AppLive } from "@app/runtime";
import { runMain } from "@app/setup/main";
import { ensureDatabaseReady } from "@app/setup/ready";
import {
  claimOpmlPreparation,
  createOpmlImport,
  finalizeOpmlImportPreparation,
  insertOpmlImportItems,
  recordOpmlImportMaterialized,
} from "@modules/opml/store";
import { matchKnownFeedsForImport, subscribeKnownOpmlItems } from "@modules/opml/known";
import { parseOpmlDocument } from "@modules/opml/parse";
import { OPML_MATERIALIZE_CHUNK_SIZE } from "@modules/opml/constants";

/**
 * bun run bench:import -- --feeds 50000 --known-ratio 0.5
 * Drives the real prepare pipeline (parse -> materialize -> match-known -> subscribe-known loop
 * -> finalize) against a real dev Postgres, using a throwaway user/feeds that are deleted (via
 * FK cascade on the user row) once the run completes, whether it succeeds or throws.
 */

type BenchArgs = { feeds: number; knownRatio: number };

/** A malformed command-line flag. */
class InvalidBenchArgs extends Data.TaggedError("InvalidBenchArgs")<{
  readonly message: string;
}> {}

/** The bench import could not be claimed for preparation, or the run could not be set up. */
class BenchFailed extends Data.TaggedError("BenchFailed")<{ readonly message: string }> {}

const parseArgs = Effect.fn("bench.import.parseArgs")(function* (argv: string[]) {
  const feedsArg = valueAfter(argv, "--feeds");
  const knownRatioArg = valueAfter(argv, "--known-ratio");
  const feedCount = feedsArg ? Number(feedsArg) : 1_000;
  const knownRatio = knownRatioArg ? Number(knownRatioArg) : 0;
  if (!Number.isFinite(feedCount) || feedCount <= 0) {
    return yield* new InvalidBenchArgs({ message: "--feeds must be a positive number" });
  }
  if (!Number.isFinite(knownRatio) || knownRatio < 0 || knownRatio > 1) {
    return yield* new InvalidBenchArgs({ message: "--known-ratio must be between 0 and 1" });
  }
  const args: BenchArgs = { feeds: feedCount, knownRatio };
  return args;
});

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

/** Insert the throwaway user and the known feeds the bench matches against. */
const seed = Effect.fn("bench.import.seed")(function* (
  userId: string,
  knownUrls: string[],
  knownFeedIds: string[],
) {
  const db = yield* Db;
  yield* db.use("bench.user.insert", (client) =>
    client.insert(users).values({
      id: userId,
      name: "import-bench",
      email: `import-bench-${userId}@bench.local`,
    }),
  );
  for (const chunkStart of range(0, knownFeedIds.length, OPML_MATERIALIZE_CHUNK_SIZE)) {
    const chunkIds = knownFeedIds.slice(chunkStart, chunkStart + OPML_MATERIALIZE_CHUNK_SIZE);
    const chunkUrls = knownUrls.slice(chunkStart, chunkStart + OPML_MATERIALIZE_CHUNK_SIZE);
    if (chunkIds.length === 0) {
      continue;
    }
    yield* db.use("bench.feeds.insert", (client) =>
      client.insert(feeds).values(
        chunkIds.map((id, offset) => ({
          id,
          url: chunkUrls[offset] as string,
          title: `Bench known feed ${offset}`,
        })),
      ),
    );
  }
});

/**
 * Deleting the user cascades to opml_imports, opml_import_items, and feed_subscriptions;
 * bench-created feeds are global rows in the shared feeds table, deleted by exact id in
 * chunks -- a LIKE-prefix scan here does a full sequential scan on a catalog-sized table.
 */
const cleanup = Effect.fn("bench.import.cleanup")(function* (
  userId: string,
  knownFeedIds: string[],
) {
  const db = yield* Db;
  yield* db.use("bench.user.delete", (client) => client.delete(users).where(eq(users.id, userId)));
  for (const chunkStart of range(0, knownFeedIds.length, OPML_MATERIALIZE_CHUNK_SIZE)) {
    const chunkIds = knownFeedIds.slice(chunkStart, chunkStart + OPML_MATERIALIZE_CHUNK_SIZE);
    if (chunkIds.length > 0) {
      yield* db.use("bench.feeds.delete", (client) =>
        client.delete(feeds).where(inArray(feeds.id, chunkIds)),
      );
    }
  }
});

const run = Effect.fn("bench.import.run")(function* (
  args: BenchArgs,
  userId: string,
  knownUrls: string[],
) {
  const db = yield* Db;
  const knownFeedCount = knownUrls.length;

  const xml = buildRepresentativeOpml(args.feeds, knownUrls);
  const sourceBytes = Buffer.byteLength(xml, "utf8");

  const created = yield* createOpmlImport({ userId, filename: "bench.opml", sourceXml: xml });

  const parseStartedAt = performance.now();
  const claimed = yield* claimOpmlPreparation(created.id);
  if (!claimed) {
    return yield* new BenchFailed({
      message: "Bench import could not be claimed for preparation",
    });
  }
  const document = yield* parseOpmlDocument(claimed.sourceXml);
  const parseMs = performance.now() - parseStartedAt;

  const materializeStartedAt = performance.now();
  const rowsInserted = yield* insertOpmlImportItems(created.id, document.feeds, new Map());
  yield* recordOpmlImportMaterialized(created.id, {
    totalItems: document.feeds.length,
    opmlTitle: document.opmlTitle,
    opmlAuthor: document.opmlAuthor,
  });
  const materializeMs = performance.now() - materializeStartedAt;

  const knownCompletionStartedAt = performance.now();
  let rowsDispatched = 0;
  yield* matchKnownFeedsForImport(created.id);
  while (true) {
    const completion = yield* subscribeKnownOpmlItems(created.id, userId);
    rowsDispatched += completion.processed;
    if (completion.processed === 0) {
      break;
    }
    yield* matchKnownFeedsForImport(created.id);
  }
  yield* finalizeOpmlImportPreparation(created.id);
  const knownCompletionMs = performance.now() - knownCompletionStartedAt;

  const [countedRow] = yield* db.use("bench.items.count", (client) =>
    client
      .select({ total: count() })
      .from(opmlImportItems)
      .where(eq(opmlImportItems.importId, created.id)),
  );
  const [finalImport] = yield* db.use("bench.import.read", (client) =>
    client.select().from(opmlImports).where(eq(opmlImports.id, created.id)).limit(1),
  );

  const expectedCompleted =
    (finalImport?.subscribedItems ?? 0) + (finalImport?.alreadySubscribedItems ?? 0);
  const counterMismatch =
    countedRow?.total !== document.feeds.length || expectedCompleted !== knownFeedCount;

  yield* Console.log(
    JSON.stringify({
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
    }),
  );
});

const bench = Effect.gen(function* () {
  yield* ensureDatabaseReady({ commandName: "bench:import" });

  const args = yield* parseArgs(process.argv.slice(2));
  const knownFeedCount = Math.round(args.feeds * args.knownRatio);
  const userId = crypto.randomUUID();
  const knownUrls = Array.from(
    { length: knownFeedCount },
    (_, i) => `https://example.com/known-feed/${i}?key=value`,
  );
  const knownFeedIds = Array.from(
    { length: knownFeedCount },
    (_, i) => `bench-feed-${userId}-${i}`,
  );

  // Cleanup runs whether the run succeeds, fails, or is interrupted.
  yield* seed(userId, knownUrls, knownFeedIds).pipe(
    Effect.andThen(run(args, userId, knownUrls)),
    Effect.ensuring(cleanup(userId, knownFeedIds).pipe(Effect.orDie)),
  );
});

// The layer scope closes Postgres and Redis once the run ends, or on SIGINT/SIGTERM.
runMain(bench.pipe(Effect.provide(AppLive)));

function* range(start: number, end: number, step: number): Generator<number> {
  for (let i = start; i < end; i += step) {
    yield i;
  }
}
