import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api-client";
import { allArticlesQueryKey } from "@modules/inbox/hooks/use-articles";
import type { ArticleListItem, ArticleListPage } from "@modules/inbox/lib/articles";

type ArticleStatePatch = Partial<Pick<ArticleListItem, "isRead" | "isSaved">> & {
  readonly isHidden?: boolean;
};

type UpdateArticleStateInput = {
  readonly itemId: string;
  readonly patch: ArticleStatePatch;
  readonly removeFromList?: boolean;
};

type ArticleStateSnapshot = InfiniteData<ArticleListPage> | undefined;

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
      await queryClient.cancelQueries({ queryKey: allArticlesQueryKey });
      const snapshot = queryClient.getQueryData<ArticleStateSnapshot>(allArticlesQueryKey);

      queryClient.setQueryData<ArticleStateSnapshot>(allArticlesQueryKey, (current) => {
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

      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(allArticlesQueryKey, context?.snapshot);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: allArticlesQueryKey });
    },
  });
}
