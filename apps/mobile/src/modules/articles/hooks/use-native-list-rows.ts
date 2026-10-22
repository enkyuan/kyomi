import { useCallback, useEffect, useRef } from "react";
import type { ArticleListHandle, ArticleListRow } from "../../../../modules/article-list";
import { diffRows } from "../lib/list-sync";

/**
 * Keeps a native `ArticleListView` showing `rows` by sending it operations instead of the rows
 * themselves, so a page of 20 costs 20 rows however long the list has grown. Returns the `ref` to
 * give the view. A view that mounts again starts empty and gets the current rows in full.
 */
export function useNativeListRows(rows: readonly ArticleListRow[]) {
  const handleRef = useRef<ArticleListHandle | null>(null);
  // The rows the mounted native view holds; `null` until it has been sent its first reset.
  const sentRef = useRef<readonly ArticleListRow[] | null>(null);
  const epochRef = useRef(0);

  const setHandle = useCallback((handle: ArticleListHandle | null) => {
    handleRef.current = handle;
    sentRef.current = null;
  }, []);

  // After every render, so it also covers the render that mounts the view. Nothing is sent when the
  // rows are the ones the view already holds.
  useEffect(() => {
    const handle = handleRef.current;
    const previous = sentRef.current;
    if (!handle || previous === rows) return;

    const ops = diffRows(previous, rows, epochRef.current + 1);
    sentRef.current = rows;
    if (ops.length === 0) return;
    if (ops[0]?.type === "reset") epochRef.current += 1;
    void handle.applyOps(JSON.stringify(ops));
  });

  return setHandle;
}
