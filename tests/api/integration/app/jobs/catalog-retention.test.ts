import { expect, test } from "bun:test";
import { Effect } from "effect";
import { sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { pruneCatalogPreviews } from "@app/jobs/catalog-retention";
import { rowsFromExecute } from "@shared/db/rows";
import { realDb } from "@api-tests/support/layers";

const url = process.env.RETENTION_TEST_DATABASE_URL;
test.skipIf(!url)(
  "expires only untouched previews and immediately promotes the first subscription",
  async () => {
    // One connection owns these temporary tables. Exercise the migration's installed trigger
    // function and real maintenance transaction without putting fixtures in application tables.
    const testRun = Effect.gen(function* () {
      const db = yield* Db;
      yield* db.use("retention.fixtures", async (client) => {
        for (const table of [
          "feeds",
          "feed_items",
          "feed_subscriptions",
          "article_reports",
          "article_view_events",
          "article_reading_state",
          "feed_item_user_state",
        ]) {
          await client.execute(
            sql.raw(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS)`),
          );
        }
        await client.execute(sql`CREATE TRIGGER subscriber_count AFTER INSERT OR DELETE OR UPDATE OF feed_id
        ON feed_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_feed_subscriber_count()`);
        await client.execute(sql`INSERT INTO feeds(id,url,title,next_refresh_at,catalog_preview)
        VALUES ('cold','https://cold.test','Cold',now()+interval '1 day',true),
               ('follow','https://follow.test','Follow',now()+interval '1 day',true)`);
        await client.execute(sql`INSERT INTO feed_items(id,feed_id,canonical_url,title,link,published_at,catalog_expires_at)
        SELECT id,CASE WHEN id='promote' THEN 'follow' ELSE 'cold' END,id,id,'https://example.org',now(),
          CASE WHEN id='legacy' THEN null ELSE now()-interval '1 day' END
        FROM unnest(ARRAY['legacy','expired','saved','promote']) ids(id)`);
        await client.execute(
          sql`INSERT INTO feed_item_user_state(user_id,feed_item_id,is_saved) VALUES ('reader','saved',true)`,
        );
        await client.execute(
          sql`INSERT INTO feed_subscriptions(id,user_id,feed_id) VALUES ('sub','reader','follow')`,
        );
      });
      yield* pruneCatalogPreviews;
      yield* pruneCatalogPreviews;
      const rows = yield* db.use("retention.verify", (c) =>
        c.execute(sql`SELECT id,catalog_expires_at FROM feed_items ORDER BY id`),
      );
      expect(rowsFromExecute(rows)).toEqual(
        ["legacy", "promote", "saved"].map((id) => ({ id, catalog_expires_at: null })),
      );
      const follow = yield* db.use("retention.follow", (c) =>
        c.execute(
          sql`SELECT subscriber_count,next_refresh_at<=now() AS due FROM feeds WHERE id='follow'`,
        ),
      );
      expect(rowsFromExecute(follow)).toEqual([{ subscriber_count: 1, due: true }]);
    });
    await Effect.runPromise(
      testRun.pipe(Effect.provide(realDb({ DATABASE_URL: url!, DATABASE_POOL_MAX: "1" }))),
    );
  },
);

test.skipIf(!url)(
  "a first subscription fetches the full feed despite a preview ETag",
  async () => {
    const { runFeedRefresh } = await import("@kyomi/ingest");
    const network = globalThis.fetch;
    const seen: (string | null)[] = [];
    const source = "https://93.184.216.34";
    const now = new Date();
    const body = JSON.stringify({
      title: "Fixture",
      home_page_url: source,
      items: [0, 1, 2, 3, 14].map((day) => ({
        id: String(day),
        url: `${source}/${day}`,
        title: `Item ${day}`,
        content_text: "Test article body.",
        tags: ["Technology"],
        date_published: new Date(now.getTime() - day * 86400000).toISOString(),
      })),
    });
    globalThis.fetch = (async (_input, init) => {
      const conditional = new Headers(init?.headers).get("if-none-match");
      seen.push(conditional);
      return new Response(conditional ? null : body, {
        status: conditional ? 304 : 200,
        headers: { "content-type": "application/feed+json", etag: '"preview"' },
      });
    }) as typeof fetch;
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.use("retention.poll_fixture", async (client) => {
            for (const table of [
              "feeds",
              "feed_items",
              "feed_subscriptions",
              "categories",
              "feed_item_tag_assignments",
              "feed_category_assignments",
              "feed_item_category_assignments",
              "favicon_hosts",
            ]) {
              await client.execute(
                sql.raw(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL)`),
              );
            }
            await client.execute(sql`INSERT INTO categories(id,slug,label,provenance,updated_at)
              VALUES ('tech','technology','Technology','catalog','2000-01-01')`);
            await client.execute(
              sql`CREATE TRIGGER subscriber_count AFTER INSERT ON feed_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_feed_subscriber_count()`,
            );
            await client.execute(sql`INSERT INTO feeds(id,url,link,title,refresh_status,favicon_url,favicon_source)
          VALUES ('fixture',${source + "/feed"},${source + "/"} ,'Fixture','queued',${source + "/icon.png"},'html_link')`);
          });
          const poll = () =>
            Effect.promise(() =>
              runFeedRefresh(db.client, "fixture", undefined, {
                catalogRefreshIntervalMs: 86400000,
              }),
            );
          expect(yield* poll()).toMatchObject({ ok: true, itemCount: 3 });
          yield* db.use("retention.requeue", (c) =>
            c.execute(sql`UPDATE feeds SET refresh_status='queued'`),
          );
          expect(yield* poll()).toMatchObject({ ok: true, notModified: true });
          yield* db.use("retention.subscribe", async (c) => {
            await c.execute(
              sql`INSERT INTO feed_subscriptions(id,user_id,feed_id) VALUES ('sub','reader','fixture')`,
            );
            await c.execute(sql`UPDATE feeds SET refresh_status='queued'`);
          });
          expect(yield* poll()).toMatchObject({ ok: true, itemCount: 5 });
          const dictionary = yield* db.use("retention.category_reuse", (c) =>
            c.execute(sql`
            SELECT updated_at = '2000-01-01'::timestamp AS reused, EXISTS(
              SELECT FROM feed_item_category_assignments WHERE category_id='tech') AS assigned
            FROM categories WHERE id='tech'`),
          );
          expect(rowsFromExecute(dictionary)).toEqual([{ reused: true, assigned: true }]);
          expect(seen).toEqual([null, '"preview"', null]);
        }).pipe(Effect.provide(realDb({ DATABASE_URL: url!, DATABASE_POOL_MAX: "1" }))),
      );
    } finally {
      globalThis.fetch = network;
    }
  },
  15000,
);
