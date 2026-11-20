import { Console, Effect } from "effect";
import { sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { prefetchArticleExtractionsForFeedItems } from "@modules/articles/reader/extraction/prefetch";
import { rowsFromExecute } from "@shared/db/rows";
import { strictPositiveIntFlag } from "@modules/catalog/args";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";

const recover = Effect.gen(function* () {
  const limit = Math.min((yield* strictPositiveIntFlag(process.argv, "--batch-size")) ?? 100, 1000);
  const db = yield* Db;
  const rows = yield* db.use("articles.recover.candidates", (client) =>
    client.execute(sql`
    SELECT id FROM feed_items
    WHERE catalog_expires_at IS NULL AND content_source='link_only' AND extracted_content_status='pending'
      AND extracted_content_updated_at IS NULL AND link ~* '^https?://'
      AND link !~ '#(item|entry)-[0-9]+$'
    ORDER BY created_at, id LIMIT ${limit}`),
  );
  const ids = rowsFromExecute<{ id: string }>(rows).map((r) => r.id);
  if (!process.argv.includes("--apply")) return yield* Console.log({ candidates: ids.length });
  const result = yield* prefetchArticleExtractionsForFeedItems({
    articleIds: ids,
    userId: "system",
    reason: "prefetch",
  });
  yield* Console.log(result);
});
runMain(recover.pipe(Effect.provide(AppLive)));
