import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { use } from "react";
import { useMediaQuery } from "@kyomi/ui/hooks/use-media-query";
import { queryKeys } from "@lib/query/keys";
import { getTimezoneOffsetMinutes } from "@lib/query/policies";
import { writeTimezoneOffsetCookie } from "@lib/timezone";
import { getInboxItemIdFromSlug } from "@modules/articles/lib/slug";
import { followedFeedsQueryOptions } from "@modules/feeds/queries/options";
import { foldersQueryOptions } from "@modules/folders/queries/options";
import { getInboxLoaderData } from "@modules/inbox/lib/api";
import { validateInboxSearch } from "@modules/inbox/lib/search";
import {
  continueReadingQueryOptions,
  inboxItemsInfiniteQueryOptions,
  inboxRecapQueryOptions,
  prefetchInboxItemDetail,
} from "@modules/inbox/queries/options";
import { InboxArrivalTransition } from "../lib/arrival-transition";

export function useInboxArrival(destination: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { play } = use(InboxArrivalTransition);
  const canShowRecap = useMediaQuery("xl");

  async function prepareInbox() {
    const keys = [
      queryKeys.inbox.all,
      queryKeys.feeds.all,
      queryKeys.folders.all,
      queryKeys.sidebar.inboxSummary,
    ];
    const target = new URL(destination, "https://kyomi.invalid");
    const search = validateInboxSearch(Object.fromEntries(target.searchParams));
    const [routes, params, destinationRoute] = router.getMatchedRoutes(target.pathname);
    if (!destinationRoute) throw new Error("The inbox route could not be loaded.");
    const articleId = search.itemId ?? getInboxItemIdFromSlug(params.article);
    const timezoneOffsetMinutes = getTimezoneOffsetMinutes();
    writeTimezoneOffsetCookie(timezoneOffsetMinutes);

    await Promise.all(
      keys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: "none" })),
    );
    const filter = search.filter
      ? Promise.resolve(search.filter)
      : getInboxLoaderData().then((data) => data.initialInboxPreferences.inboxDefaultView);
    // Warm the route modules without running guards or speculative loaders before navigation.
    await Promise.all([
      ...routes.map((route) => router.loadRouteChunk(route)),
      queryClient.fetchQuery(followedFeedsQueryOptions()),
      queryClient.fetchQuery(foldersQueryOptions()),
      ...(canShowRecap
        ? [
            queryClient.fetchQuery(inboxRecapQueryOptions()),
            queryClient.fetchQuery(continueReadingQueryOptions()),
          ]
        : []),
      // Let the reader own unavailable deep links so they cannot block onboarding completion.
      prefetchInboxItemDetail(queryClient, articleId),
      filter.then((value) =>
        queryClient.fetchInfiniteQuery(
          inboxItemsInfiniteQueryOptions({ ...search, filter: value, timezoneOffsetMinutes }),
        ),
      ),
    ]);
    // Arrive with the filter that the inbox would otherwise set on mount.
    target.searchParams.set("filter", await filter);
    return target.pathname + target.search + target.hash;
  }

  return function openInbox(finishSetup: () => Promise<void>, button: HTMLButtonElement | null) {
    const rect = button?.getBoundingClientRect();
    return play(
      async () => {
        await finishSetup();
        const inboxHref = await prepareInbox();
        if (router.state.location.pathname !== "/onboarding") {
          throw new Error("Onboarding is no longer the active route.");
        }
        return inboxHref;
      },
      (href) => router.navigate({ href, replace: true }),
      rect && [rect.left + rect.width / 2, rect.top + rect.height / 2],
    );
  };
}
