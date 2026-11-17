import { Console, Data, Effect } from "effect";
import { searchFeeds } from "@modules/discover/operations";
import { valueAfter } from "@modules/catalog/args";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";
import { ensureDatabaseReady } from "../setup/ready";

/** The probe query returned nothing, or nothing containing the expected token. */
class SmokeFailed extends Data.TaggedError("SmokeFailed")<{ readonly message: string }> {}

const smoke = Effect.gen(function* () {
  const query = valueAfter(process.argv, "--query") ?? "hacker news";
  const expected = (valueAfter(process.argv, "--expect") ?? "hacker news").toLowerCase();
  const probeUserId =
    valueAfter(process.argv, "--user-id") ?? "00000000-0000-0000-0000-000000000000";
  const limit = Number(valueAfter(process.argv, "--limit") ?? "20");

  yield* ensureDatabaseReady({ commandName: "catalog:smoke", ensureSchema: true });

  const rows = yield* searchFeeds(probeUserId, query, Number.isFinite(limit) ? limit : 20);
  if (rows.length === 0) {
    return yield* new SmokeFailed({ message: `No results for query "${query}"` });
  }

  const matched = rows.some((row) =>
    `${row.title} ${row.url} ${row.description ?? ""}`.toLowerCase().includes(expected),
  );
  if (!matched) {
    return yield* new SmokeFailed({
      message: `No results matched expected token "${expected}" for query "${query}"`,
    });
  }

  yield* Console.log(
    JSON.stringify(
      {
        query,
        expected,
        resultCount: rows.length,
        topResult: rows[0]?.title ?? null,
      },
      null,
      2,
    ),
  );
});

// The layer scope closes Postgres and Redis once the run ends, or on SIGINT/SIGTERM.
runMain(smoke.pipe(Effect.provide(AppLive)));
