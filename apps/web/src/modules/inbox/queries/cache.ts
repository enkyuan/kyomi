import type { QueryClient } from "@tanstack/react-query";
import type { Folder } from "@modules/folders/lib/api";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";
import { queryKeys } from "@lib/query/keys";

export function applyFolderPinState(
  queryClient: QueryClient,
  folderId: string,
  isPinned: boolean,
  pinnedAt: string | null = isPinned ? new Date().toISOString() : null,
) {
  queryClient.setQueryData<InboxRecapDto>(queryKeys.inbox.recap, (current) =>
    current
      ? {
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === folderId ? { ...folder, isPinned, pinnedAt } : folder,
          ),
        }
      : current,
  );
  queryClient.setQueryData<Folder[]>(queryKeys.folders.all, (current) =>
    current?.map((folder) => (folder.id === folderId ? { ...folder, isPinned, pinnedAt } : folder)),
  );
}
