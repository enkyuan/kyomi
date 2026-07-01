"use client";

import {
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { Button } from "@kyomi/ui/button";
import {
  Dialog as UiDialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@kyomi/ui/dialog";
import { TableFrame } from "./table";
import { getColumns, type FeedRow, type FolderOption } from "./table-config";
import { toastManager } from "@kyomi/ui/toast";
import {
  listFollowedFeeds,
  moveFeedsToFolder,
  type FollowedFeed,
  unfollowFeed,
} from "@modules/feeds/api";
import {
  applyFeedFolder,
  getFollowedFeedsSnapshot,
  removeFollowedFeeds,
  restoreFeedCacheSnapshot,
} from "@modules/feeds/queries/cache";
import { listFolders } from "@modules/folders";
import { usePinnedFeedIds } from "@modules/feeds/hooks/use-pinned-feed-ids";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const feedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return feedDateFormatter.format(date);
}

function getSourceLabel(feed: FollowedFeed) {
  const candidate = feed.link ?? feed.url;

  try {
    return new URL(candidate).hostname.replace(/^www\./, "");
  } catch {
    return candidate;
  }
}

export function Dialog({ open, onOpenChange }: DialogProps) {
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [movingFeedId, setMovingFeedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    data: followedFeedsData,
    isError: isFollowedFeedsError,
    isLoading: isFollowedFeedsLoading,
  } = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
    enabled: open,
  });
  const { data: foldersData } = useQuery({
    queryKey: ["folders"],
    queryFn: () => listFolders(),
    enabled: open,
  });
  const { pinnedFeedIdSet, setPinned } = usePinnedFeedIds();
  const folderOptions = useMemo<FolderOption[]>(
    () => (foldersData ?? []).map((folder) => ({ label: folder.name, value: folder.id })),
    [foldersData],
  );
  const unsortedFolderId = useMemo(
    () => (foldersData ?? []).find((folder) => folder.name === "Unsorted")?.id ?? null,
    [foldersData],
  );

  const moveFeedFolderMutation = useMutation({
    mutationFn: ({ feedId, folderId }: { feedId: string; folderId: string }) =>
      moveFeedsToFolder({ data: { feedIds: [feedId], folderId } }),
    onMutate: async ({ feedId, folderId }) => {
      await queryClient.cancelQueries({ queryKey: ["feeds", "followed"] });
      const snapshot = getFollowedFeedsSnapshot(queryClient);
      setMovingFeedId(feedId);
      const targetFolder = folderOptions.find((option) => option.value === folderId);
      applyFeedFolder(queryClient, feedId, { id: folderId, name: targetFolder?.label });
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      restoreFeedCacheSnapshot(queryClient, context?.snapshot);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feeds", "followed"] });
    },
    onSettled: () => {
      setMovingFeedId(null);
    },
  });
  const deleteFeedsMutation = useMutation({
    mutationFn: async ({ feedIds }: { feedIds: string[] }) => {
      await Promise.all(feedIds.map((feedId) => unfollowFeed({ data: { feedId } })));
      return { feedIds };
    },
    onMutate: async ({ feedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["feeds", "followed"] });
      const snapshot = getFollowedFeedsSnapshot(queryClient);
      removeFollowedFeeds(queryClient, feedIds);
      setRowSelection({});
      return { snapshot };
    },
    onSuccess: async ({ feedIds }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feeds", "followed"] }),
        queryClient.invalidateQueries({ queryKey: ["feeds", "followed", "unread-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
      ]);
      toastManager.add({
        title: feedIds.length === 1 ? "Feed deleted" : "Feeds deleted",
        description:
          feedIds.length === 1
            ? "The selected feed has been removed from your following."
            : `${feedIds.length} selected feeds were removed from your following.`,
        type: "success",
      });
    },
    onError: (error, _variables, context) => {
      restoreFeedCacheSnapshot(queryClient, context?.snapshot);
      logClientError("feeds.manage.unfollow", error);
      toastManager.add({
        title: "Unable to remove selected feeds",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const tableData = useMemo<FeedRow[]>(() => {
    return (followedFeedsData ?? []).map((feed) => ({
      id: feed.feedId,
      title: feed.title || feed.url,
      url: feed.url,
      folderId: feed.folderId ?? unsortedFolderId,
      folderName: feed.folderName ?? "Unsorted",
      source: getSourceLabel(feed),
      followedAtLabel: formatDateLabel(feed.subscribedAt),
    }));
  }, [followedFeedsData, unsortedFolderId]);

  const columns = useMemo(
    () =>
      getColumns({
        folderOptions,
        movingFeedId,
        pinnedFeedIdSet,
        onMoveToFolder: (feedId, folderId) => {
          if (moveFeedFolderMutation.isPending) {
            return;
          }
          moveFeedFolderMutation.mutate({ feedId, folderId });
        },
        onTogglePinned: (feedId) => setPinned(feedId, !pinnedFeedIdSet.has(feedId)),
      }),
    [folderOptions, moveFeedFolderMutation, movingFeedId, pinnedFeedIdSet, setPinned],
  );

  const table = useReactTable({
    columns,
    data: tableData,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    state: {
      pagination,
      rowSelection,
    },
  });

  const selectedCount = table.getSelectedRowModel().rows.length;
  const selectedFeedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
  return (
    <UiDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setRowSelection({});
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogPopup className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage feeds</DialogTitle>
          <DialogDescription>
            Review the feeds in your workspace and the folders they currently belong to.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="pt-0">
          <TableFrame
            columnsLength={columns.length}
            isError={isFollowedFeedsError}
            isLoading={isFollowedFeedsLoading}
            selectedCount={selectedCount}
            table={table}
            tableData={tableData}
          />
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Close</DialogClose>
          <Button
            disabled={selectedCount === 0 || deleteFeedsMutation.isPending}
            variant="destructive"
            onClick={() => {
              if (selectedFeedIds.length === 0 || deleteFeedsMutation.isPending) {
                return;
              }

              deleteFeedsMutation.mutate({ feedIds: selectedFeedIds });
            }}
          >
            {deleteFeedsMutation.isPending
              ? "Deleting…"
              : selectedCount === 1
                ? "Delete selected feed"
                : "Delete selected feeds"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </UiDialog>
  );
}
