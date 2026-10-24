import { useEffect } from "react";
import type { useArticles } from "./use-articles";

type PagingQuery = Pick<
  ReturnType<typeof useArticles>,
  | "hasNextPage"
  | "isLoading"
  | "isFetchingNextPage"
  | "isRefetching"
  | "isError"
  | "pageCount"
  | "fetchNextPage"
>;

/** A client-side filter must not hide later server pages behind an empty state. */
export function shouldFetchEmptyPage(
  visibleCount: number,
  query: Omit<PagingQuery, "fetchNextPage" | "pageCount">,
) {
  return (
    visibleCount === 0 &&
    query.hasNextPage &&
    !query.isLoading &&
    !query.isFetchingNextPage &&
    !query.isRefetching &&
    !query.isError
  );
}

export function useEmptyPage(visibleCount: number, query: PagingQuery) {
  const {
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    isError,
    pageCount,
    fetchNextPage,
  } = query;
  useEffect(() => {
    if (
      shouldFetchEmptyPage(visibleCount, {
        hasNextPage,
        isLoading,
        isFetchingNextPage,
        isRefetching,
        isError,
      })
    ) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [
    visibleCount,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    isError,
    pageCount,
    fetchNextPage,
  ]);
}
