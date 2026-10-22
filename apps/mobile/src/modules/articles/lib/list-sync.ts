import type { ArticleListOp, ArticleListRow } from "../../../../modules/article-list";

function sameList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Rows are rebuilt for changed items only, but a row that is equal in content is still unchanged. */
function sameRow(a: ArticleListRow, b: ArticleListRow) {
  return (
    a === b ||
    (a.id === b.id &&
      a.kind === b.kind &&
      a.sourceLabel === b.sourceLabel &&
      a.timeLabel === b.timeLabel &&
      a.title === b.title &&
      a.summary === b.summary &&
      a.feedTitle === b.feedTitle &&
      a.isSaved === b.isSaved &&
      a.isContinuing === b.isContinuing &&
      sameList(a.faviconUrls, b.faviconUrls))
  );
}

/**
 * The operations that turn the rows the native list holds (`previous`, or `null` for a list that
 * holds none) into `next`. A page appended, a row edited or removed in place cost one operation
 * each, proportional to what changed; any other change, such as another scope or filter, resets
 * the list with `epoch`.
 */
export function diffRows(
  previous: readonly ArticleListRow[] | null,
  next: readonly ArticleListRow[],
  epoch: number,
): ArticleListOp[] {
  if (previous === next) return [];

  const reset: ArticleListOp[] = [{ epoch, rows: next, type: "reset" }];
  if (previous === null) return reset;

  const nextById = new Map<string, ArticleListRow>();
  for (const row of next) nextById.set(row.id, row);
  // The native list shows each id once, so a repeated id would shift every later position.
  if (nextById.size !== next.length) return reset;

  const removed: string[] = [];
  const updated: ArticleListRow[] = [];
  // Every previous row that survives must sit at the same position among the survivors.
  let cursor = 0;
  for (const row of previous) {
    const kept = nextById.get(row.id);
    if (kept === undefined) {
      removed.push(row.id);
      continue;
    }
    if (next[cursor]?.id !== row.id) return reset;
    if (!sameRow(row, kept)) updated.push(kept);
    cursor += 1;
  }
  // Nothing survived: this is another data set (a different scope), not an edit of the same one.
  if (cursor === 0 && previous.length > 0) return reset;
  const appended = next.slice(cursor);

  const ops: ArticleListOp[] = [];
  if (removed.length > 0) ops.push({ ids: removed, type: "remove" });
  if (updated.length > 0) ops.push({ rows: updated, type: "update" });
  if (appended.length > 0) ops.push({ rows: appended, type: "append" });
  return ops;
}
