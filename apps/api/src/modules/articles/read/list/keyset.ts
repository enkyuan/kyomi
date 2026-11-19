import { and, asc, desc, eq, gt, lt, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { ArticleSort } from "@modules/articles/params";

/** The columns a keyset page is ordered by: the sort instant, the tie-break id, and read state. */
export type KeysetColumns = {
  at: AnyColumn;
  id: AnyColumn;
  isRead: SQL | AnyColumn;
};

/** The last row of the previous page. `isRead` is present for `unread-first` cursors. */
export type KeysetBoundary = { at: Date; id: string; isRead?: boolean };

/** Rows strictly after `boundary` in the order `keysetOrderBy` produces for `sort`. */
export function keysetFilter(columns: KeysetColumns, sort: ArticleSort, boundary: KeysetBoundary) {
  const olderThanBoundary = or(
    lt(columns.at, boundary.at),
    and(eq(columns.at, boundary.at), lt(columns.id, boundary.id)),
  )!;
  if (sort === "oldest") {
    return or(
      gt(columns.at, boundary.at),
      and(eq(columns.at, boundary.at), gt(columns.id, boundary.id)),
    )!;
  }
  if (sort === "unread-first" && boundary.isRead !== undefined) {
    return boundary.isRead
      ? and(sql`(${columns.isRead}) = true`, olderThanBoundary)!
      : or(
          sql`(${columns.isRead}) = true`,
          and(sql`(${columns.isRead}) = false`, olderThanBoundary),
        )!;
  }
  return olderThanBoundary;
}

export function keysetOrderBy(columns: KeysetColumns, sort: ArticleSort) {
  if (sort === "oldest") {
    return [asc(columns.at), asc(columns.id)] as const;
  }
  if (sort === "unread-first") {
    return [asc(columns.isRead), desc(columns.at), desc(columns.id)] as const;
  }
  return [desc(columns.at), desc(columns.id)] as const;
}
