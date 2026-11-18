import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import { articleListQueryKeys } from "@modules/articles/queries/keys";
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
        articleListQueryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
      );
      // Update both lists immediately; restore snapshots if the request fails.
      const snapshots = articleListQueryKeys.map((queryKey) => {
        const snapshot = queryClient.getQueryData<ArticleStateSnapshot>(queryKey);
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

        return {
          queryKey,
          snapshot,
          optimistic: queryClient.getQueryData<ArticleStateSnapshot>(queryKey),
        };
      });

      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const { queryKey, snapshot, optimistic } of context?.snapshots ?? []) {
        // Undo only what this mutation wrote. A list that was cleared (sign-out) or replaced
        // (another account, a refetch) since is no longer ours, and the snapshot would put the
        // previous account's articles back, and into the persisted copy.
        if (queryClient.getQueryData<ArticleStateSnapshot>(queryKey) === optimistic) {
          queryClient.setQueryData(queryKey, snapshot);
        }
      }
    },
    onSettled: () => {
      for (const queryKey of articleListQueryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
