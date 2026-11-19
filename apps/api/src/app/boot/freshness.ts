import { Console, Effect } from "effect";
import { sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { rowsFromExecute } from "@shared/db/rows";
import { AppLive } from "../runtime";
import { runMain } from "../setup/main";

const report = Effect.gen(function* () {
  const db = yield* Db;
  const result = yield* db.use("feed.freshness.report", (client) =>
    client.execute(sql`
    SELECT CASE WHEN subscriber_count>0 THEN 'subscribed' ELSE 'catalog' END AS lane,
      count(*) AS feeds, count(last_refresh_succeeded_at) AS ever_successful,
      count(*) FILTER (WHERE last_refresh_succeeded_at >= now() - interval '24 hours') AS successful_24h,
      round(100.0 * count(*) FILTER (WHERE last_refresh_succeeded_at >= now() - interval '24 hours')/count(*),2) AS coverage_pct,
      max(now()-coalesce(next_refresh_at,created_at)) FILTER (WHERE refresh_status NOT IN ('running','queued')
        AND coalesce(next_refresh_at,created_at)<=now()) AS oldest_overdue,
      max(now()-updated_at) FILTER (WHERE refresh_status='queued') AS oldest_queued,
      count(*) FILTER (WHERE last_refresh_error='HTTP 429' AND last_refresh_failed_at>=now()-interval '24 hours') AS latest_429_24h
    FROM feeds GROUP BY 1 ORDER BY 1`),
  );
  yield* Console.table(rowsFromExecute(result));
});
runMain(report.pipe(Effect.provide(AppLive)));
