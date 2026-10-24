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
      a.isSaved === b.isSaved &&
      a.isContinuing === b.isContinuing &&
      sameList(a.faviconUrls, b.faviconUrls))
  );
}

/** Where a paged list stands, as the query reports it. */
export type ListPaging = {
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  /** Pages fetched so far; it must grow with every page, including one that adds no visible row. */
  readonly pageCount: number;
};

/** The operation that moves the native list's paging from `previous` to `next`, if they differ. */
export function diffPaging(previous: ListPaging | null, next: ListPaging): ArticleListOp | null {
  if (
    previous !== null &&
    previous.hasMore === next.hasMore &&
    previous.isLoadingMore === next.isLoadingMore &&
    previous.pageCount === next.pageCount
  ) {
    return null;
  }
  return {
    hasMore: next.hasMore,
    isLoadingMore: next.isLoadingMore,
    pageCount: next.pageCount,
    type: "paging",
  };
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

/** Serial delivery with one latest desired state; rejected batches recover with a full reset. */
export function createListSync(
  send: (payload: string) => Promise<void>,
  onError: (error: unknown) => void,
) {
  type Desired = { rows: readonly ArticleListRow[]; paging?: ListPaging; dataset: string };
  let desired: Desired | undefined;
  let accepted: Desired | undefined;
  let running = false;
  let disposed = false;
  let epoch = 0;

  let acceptedDataset: string | undefined;

  async function deliver(next: Desired) {
    const changedDataset = acceptedDataset !== undefined && acceptedDataset !== next.dataset;
    const ops = diffRows(changedDataset ? null : (accepted?.rows ?? null), next.rows, epoch + 1);
    if (ops[0]?.type === "reset") {
      epoch += 1;
      if (changedDataset) ops[0] = { ...ops[0], scrollToTop: true };
    }
    const paging = next.paging ?? { hasMore: false, isLoadingMore: false, pageCount: 0 };
    const pagingOp = diffPaging(accepted?.paging ?? null, paging);
    if (pagingOp) ops.push(pagingOp);
    try {
      if (ops.length > 0) await send(JSON.stringify(ops));
      accepted = { ...next, paging };
      acceptedDataset = next.dataset;
      return true;
    } catch (error) {
      accepted = undefined;
      onError(error);
      return false;
    }
  }

  async function flush() {
    if (running || disposed) return;
    running = true;
    let failures = 0;
    try {
      while (desired && !disposed) {
        const next = desired;
        desired = undefined;
        if (await deliver(next)) {
          failures = 0;
          continue;
        }
        // One immediate full-state recovery; further updates or a remount may retry later.
        if (++failures > 1) break;
        desired ??= next;
      }
    } finally {
      running = false;
    }
  }

  return {
    update(rows: readonly ArticleListRow[], paging?: ListPaging, dataset = "default") {
      desired = { rows, paging, dataset };
      void flush();
    },
    dispose() {
      disposed = true;
      desired = undefined;
    },
  };
}
