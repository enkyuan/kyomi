import type { QueryClient } from "@tanstack/react-query";
import type { Folder } from "@modules/folders/lib/api";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { followedFeedsQueryKey, inboxRecapQueryKey } from "@modules/inbox/queries/options";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";

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

export function applyFolderPinState(
  queryClient: QueryClient,
  folderId: string,
  isPinned: boolean,
  pinnedAt: string | null = isPinned ? new Date().toISOString() : null,
) {
  queryClient.setQueryData<InboxRecapDto>(inboxRecapQueryKey(), (current) =>
    current
      ? {
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === folderId ? { ...folder, isPinned, pinnedAt } : folder,
          ),
        }
      : current,
  );
  queryClient.setQueryData<Folder[]>(["folders"], (current) =>
    current?.map((folder) => (folder.id === folderId ? { ...folder, isPinned, pinnedAt } : folder)),
  );
}
