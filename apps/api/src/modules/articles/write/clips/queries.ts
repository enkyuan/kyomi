import { articleClips } from "@kyomi/db";
import { and, asc, desc, eq, gt, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import type { Database } from "@adapters/db/service";
import type { ArticleSort } from "@modules/articles/params";
import { escapeLikePattern } from "@modules/articles/read/sql";
import { attachReadingProgress } from "@modules/articles/progress/read";
import type { ArticlesCursorListResponseDto } from "@modules/articles/types";
import { clipReadColumns, type ClipReadRow } from "./columns";
import { clipToListItem } from "./detail";

export type ListClipsOptions = {
  search?: string;
  isRead?: boolean;
  isSaved?: boolean;
  publishedAfter?: Date;
  publishedBefore?: Date;
  sort?: ArticleSort;
  limit: number;
  cursor?: string;
  /** Merged feed+clip pagination boundary in the active sort order. */
  exclusiveBefore?: { publishedAt: Date; id: string; isRead?: boolean };
};

type ClipCursor = { publishedAt: Date; id: string; isRead?: boolean };

function pushClipSortBoundaryFilter(filters: SQL[], sort: ArticleSort, cursor: ClipCursor): void {
  const olderThanCursor = or(
    lt(articleClips.createdAt, cursor.publishedAt),
    and(eq(articleClips.createdAt, cursor.publishedAt), lt(articleClips.id, cursor.id)),
  )!;
  if (sort === "oldest") {
    filters.push(
      or(
        gt(articleClips.createdAt, cursor.publishedAt),
        and(eq(articleClips.createdAt, cursor.publishedAt), gt(articleClips.id, cursor.id)),
      )!,
    );
    return;
  }
  if (sort === "unread-first" && cursor.isRead !== undefined) {
    filters.push(
      cursor.isRead
        ? and(eq(articleClips.isRead, true), olderThanCursor)!
        : or(eq(articleClips.isRead, true), and(eq(articleClips.isRead, false), olderThanCursor))!,
    );
    return;
  }
  filters.push(olderThanCursor);
}

function clipOrderByForSort(sort: ArticleSort) {
  if (sort === "oldest") {
    return [asc(articleClips.createdAt), asc(articleClips.id)] as const;
  }
  if (sort === "unread-first") {
    return [asc(articleClips.isRead), desc(articleClips.createdAt), desc(articleClips.id)] as const;
  }
  return [desc(articleClips.createdAt), desc(articleClips.id)] as const;
}

/** One page of the user's clips (up to `take` rows) for the filters, sort and boundary in `opts`. */
async function listClipRows(
  database: Database,
  userId: string,
  opts: ListClipsOptions,
  take: number,
): Promise<ClipReadRow[]> {
  const sort = opts.sort ?? "latest";
  const filters: SQL[] = [eq(articleClips.userId, userId)];
  if (opts.isRead !== undefined) {
    filters.push(eq(articleClips.isRead, opts.isRead));
  }
  if (opts.isSaved !== undefined) {
    filters.push(eq(articleClips.isSaved, opts.isSaved));
  }
  if (opts.publishedAfter) {
    filters.push(gte(articleClips.createdAt, opts.publishedAfter));
  }
  if (opts.publishedBefore) {
    filters.push(lt(articleClips.createdAt, opts.publishedBefore));
  }
  const search = opts.search?.trim();
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    filters.push(
      or(
        ilike(articleClips.title, pattern),
        ilike(articleClips.note, pattern),
        ilike(articleClips.url, pattern),
      )!,
    );
  }

  if (opts.exclusiveBefore) {
    pushClipSortBoundaryFilter(filters, sort, opts.exclusiveBefore);
  } else if (opts.cursor) {
    const [cursor] = await database
      .select({
        createdAt: articleClips.createdAt,
        id: articleClips.id,
        isRead: articleClips.isRead,
      })
      .from(articleClips)
      .where(and(eq(articleClips.id, opts.cursor), eq(articleClips.userId, userId)))
      .limit(1);
    if (cursor) {
      pushClipSortBoundaryFilter(filters, sort, {
        publishedAt: cursor.createdAt,
        id: cursor.id,
        isRead: cursor.isRead,
      });
    }
  }

  return database
    .select(clipReadColumns)
    .from(articleClips)
    .where(and(...filters))
    .orderBy(...clipOrderByForSort(sort))
    .limit(take);
}

const CLIP_LIST_MAX_LIMIT = 200;

/** One keyset page of the user's clips with their reading progress attached. */
export async function listClipsForUser(
  database: Database,
  userId: string,
  opts: ListClipsOptions,
): Promise<ArticlesCursorListResponseDto> {
  const limit = Math.min(Math.max(opts.limit, 1), CLIP_LIST_MAX_LIMIT);
  const rows = await listClipRows(database, userId, opts, limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;
  return {
    items: await attachReadingProgress(
      database,
      userId,
      page.map((row) => clipToListItem(row)),
    ),
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: null,
  };
}
