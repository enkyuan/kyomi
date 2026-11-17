import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@kyomi/db";
import { Db, type Database } from "@adapters/db/service";

const isSubscribed = sql<boolean>`CASE WHEN ${feedSubscriptions.id} IS NULL THEN false ELSE true END`;

const feedColumns = {
  id: feeds.id,
  url: feeds.url,
  title: feeds.title,
  description: feeds.description,
  link: feeds.link,
  faviconUrl: feeds.faviconUrl,
  isSubscribed,
};

const subscriptionOf = (userId: string) =>
  and(eq(feedSubscriptions.feedId, feeds.id), eq(feedSubscriptions.userId, userId));

function dbUse<A>(operation: string, run: (client: Database) => Promise<A>) {
  return Db.use((db) => db.use(operation, run));
}

/** The feed row with this canonical URL, with whether `userId` follows it. */
export const findFeedWithSubscription = (userId: string, url: string) =>
  dbUse("discover.feed.by_url", async (client) => {
    const rows = await client
      .select(feedColumns)
      .from(feeds)
      .leftJoin(feedSubscriptions, subscriptionOf(userId))
      .where(eq(feeds.url, url))
      .limit(1);
    return rows[0] ?? null;
  });

export const findFeedByUrl = (url: string) =>
  dbUse("discover.feed.id_by_url", async (client) => {
    const rows = await client
      .select({ id: feeds.id, faviconUrl: feeds.faviconUrl })
      .from(feeds)
      .where(eq(feeds.url, url))
      .limit(1);
    return rows[0] ?? null;
  });

export const isFollowingFeed = (userId: string, feedId: string) =>
  dbUse("discover.feed.is_following", async (client) => {
    const rows = await client
      .select({ id: feedSubscriptions.id })
      .from(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
      .limit(1);
    return rows.length > 0;
  });

export const findFeedsWithSubscription = (userId: string, feedIds: string[]) =>
  dbUse("discover.feed.by_ids", (client) =>
    client
      .select(feedColumns)
      .from(feeds)
      .leftJoin(feedSubscriptions, subscriptionOf(userId))
      .where(inArray(feeds.id, feedIds)),
  );

/** Title/URL substring match, best matches first (exact title, exact URL, followed, prefix, rest). */
export const searchFeedRows = (userId: string, query: string, scanLimit: number) => {
  const pattern = `%${query}%`;
  return dbUse("discover.feed.search", (client) =>
    client
      .select({
        ...feedColumns,
        score: sql<number>`
          CASE
            WHEN lower(${feeds.title}) = lower(${query}) THEN 0
            WHEN lower(${feeds.url}) = lower(${query}) THEN 1
            WHEN ${feedSubscriptions.id} IS NOT NULL THEN 2
            WHEN lower(${feeds.title}) LIKE lower(${pattern}) THEN 3
            ELSE 4
          END
        `.as("score"),
      })
      .from(feeds)
      .leftJoin(feedSubscriptions, subscriptionOf(userId))
      .where(or(ilike(feeds.title, pattern), ilike(feeds.url, pattern)))
      .orderBy(sql`score`, asc(feeds.title))
      .limit(scanLimit),
  );
};
