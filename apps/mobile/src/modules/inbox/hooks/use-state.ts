import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import {
  exploreArticlesQueryKey,
  subscribedArticlesQueryKey,
} from "@modules/inbox/hooks/use-articles";
import type { ArticleListItemDto, CursorListResponseDto } from "@kyomi/reader/schemas/article";

type ArticleStatePatch = Partial<Pick<ArticleListItemDto, "isRead" | "isSaved">> & {
  readonly isHidden?: boolean;
};

type UpdateArticleStateInput = {
  readonly itemId: string;
  readonly patch: ArticleStatePatch;
  readonly removeFromList?: boolean;
};

type ArticleStateSnapshot = InfiniteData<CursorListResponseDto> | undefined;
const articleQueryKeys = [exploreArticlesQueryKey, subscribedArticlesQueryKey] as const;

async function updateArticleState({ itemId, patch }: UpdateArticleStateInput) {
  return fetchMobileApiJson<{ message: string }>(`/api/v1/articles/${encodeURIComponent(itemId)}`, {
    body: JSON.stringify(patch),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

export function useArticleStateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateArticleState,
    onMutate: async ({ itemId, patch, removeFromList }) => {
      await Promise.all(
        articleQueryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
      );
      const snapshots = articleQueryKeys.map((queryKey) => ({
        queryKey,
        snapshot: queryClient.getQueryData<ArticleStateSnapshot>(queryKey),
      }));

      // Update both lists immediately; restore snapshots if the request fails.
      for (const queryKey of articleQueryKeys) {
        queryClient.setQueryData<ArticleStateSnapshot>(queryKey, (current) => {
          if (!current) return current;

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: removeFromList
                ? page.items.filter((item) => item.id !== itemId)
                : page.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            })),
          };
        });
      }

      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const { queryKey, snapshot } of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, snapshot);
      }
    },
    onSettled: () => {
      for (const queryKey of articleQueryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
