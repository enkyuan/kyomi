import type { QueryClient } from "@tanstack/react-query";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";

function updateFollowedFeeds(
  queryClient: QueryClient,
  update: (feeds: FollowedFeed[]) => FollowedFeed[],
) {
  queryClient.setQueryData<FollowedFeed[] | undefined>(followedFeedsQueryKey(), (current) =>
    current ? update(current) : current,
  );
}

export function applyFeedFolder(
  queryClient: QueryClient,
  feedId: string,
  folder: { id: string; name?: string },
) {
  updateFollowedFeeds(queryClient, (feeds) =>
    feeds.map((feed) =>
      feed.feedId === feedId
        ? { ...feed, folderId: folder.id, folderName: folder.name ?? feed.folderName }
        : feed,
    ),
  );
}
