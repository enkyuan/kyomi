import { useCallback, useEffect, useRef } from "react";
import type { ArticleListHandle, ArticleListRow } from "../../../../modules/article-list";
import { createListSync, type ListPaging } from "../lib/list-sync";

/** Synchronizes only changed rows; each mounted view has its own ordered delivery session. */
export function useNativeListSync(
  rows: readonly ArticleListRow[],
  paging?: ListPaging,
  dataset = "default",
) {
  const session = useRef<ReturnType<typeof createListSync> | null>(null);
  const setHandle = useCallback((handle: ArticleListHandle | null) => {
    session.current?.dispose();
    session.current = handle
      ? createListSync(
          (payload) => handle.applyOps(payload),
          (error) => {
            console.error("[article-list] native update failed", error);
          },
        )
      : null;
  }, []);

  useEffect(() => {
    session.current?.update(rows, paging, dataset);
  });
  return setHandle;
}
