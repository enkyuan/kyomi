import { useCallback, useEffect, useRef } from "react";
import type {
  ArticleListHandle,
  ArticleListOp,
  ArticleListRow,
} from "../../../../modules/article-list";
import { diffPaging, diffRows, type ListPaging } from "../lib/list-sync";

/**
 * Keeps a native `ArticleListView` showing `rows` and knowing where paging stands, by sending it
 * operations instead of the rows themselves, so a page of 20 costs 20 rows however long the list
 * has grown. Pass `paging` for a list that loads pages; leave it out for one that does not.
 * Returns the `ref` to give the view. A view that mounts again starts empty and gets the current
 * state in full.
 */
export function useNativeListSync(rows: readonly ArticleListRow[], paging?: ListPaging) {
  const handleRef = useRef<ArticleListHandle | null>(null);
  // What the mounted native view holds; `null` until it has been sent its first operations.
  const sentRowsRef = useRef<readonly ArticleListRow[] | null>(null);
  const sentPagingRef = useRef<ListPaging | null>(null);
  const epochRef = useRef(0);

  const setHandle = useCallback((handle: ArticleListHandle | null) => {
    handleRef.current = handle;
    sentRowsRef.current = null;
    sentPagingRef.current = null;
  }, []);

  // After every render, so it also covers the render that mounts the view. Nothing is sent when
  // the view already holds the rows and paging state.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    // Rows go first: paging describes them, and the native side applies a batch in order.
    const ops: ArticleListOp[] = diffRows(sentRowsRef.current, rows, epochRef.current + 1);
    if (ops[0]?.type === "reset") epochRef.current += 1;
    sentRowsRef.current = rows;

    if (paging) {
      const pagingOp = diffPaging(sentPagingRef.current, paging);
      if (pagingOp) {
        ops.push(pagingOp);
        sentPagingRef.current = paging;
      }
    }

    if (ops.length > 0) void handle.applyOps(JSON.stringify(ops));
  });

  return setHandle;
}
