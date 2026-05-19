"use client";

import {
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@components/ui/dialog";
import {
  getManageFeedsColumns,
  ManageFeedsTableFrame,
  type FeedRow,
  type FolderOption,
} from "./manage-feeds-table";
import { toastManager } from "@components/ui/toast";
import {
  listFollowedFeeds,
  moveFeedsToFolder,
  type FollowedFeed,
  unfollowFeed,
} from "../services/api";
import { listFolders } from "@modules/folders";
import { usePinnedFeedIds } from "../hooks/use-pinned-feed-ids";

type ManageFeedsDialogProps = {
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

export function ManageFeedsDialog({ open, onOpenChange }: ManageFeedsDialogProps) {
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [movingFeedId, setMovingFeedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const followedFeedsQuery = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
    enabled: open,
  });
  const foldersQuery = useQuery({
    queryKey: ["folders"],
    queryFn: () => listFolders(),
    enabled: open,
  });
  const { pinnedFeedIdSet, setPinned } = usePinnedFeedIds();
  const folderOptions = useMemo<FolderOption[]>(
    () => (foldersQuery.data ?? []).map((folder) => ({ label: folder.name, value: folder.id })),
    [foldersQuery.data],
  );
  const unsortedFolderId = useMemo(
    () => (foldersQuery.data ?? []).find((folder) => folder.name === "Unsorted")?.id ?? null,
    [foldersQuery.data],
  );

  const moveFeedFolderMutation = useMutation({
    mutationFn: ({ feedId, folderId }: { feedId: string; folderId: string }) =>
      moveFeedsToFolder({ data: { feedIds: [feedId], folderId } }),
    onMutate: ({ feedId }) => {
      setMovingFeedId(feedId);
    },
    onSuccess: (_, { feedId, folderId }) => {
      const targetFolder = folderOptions.find((option) => option.value === folderId);
      queryClient.setQueryData(["feeds", "followed"], (current: FollowedFeed[] | undefined) =>
        current?.map((feed) =>
          feed.feedId === feedId
            ? { ...feed, folderId, folderName: targetFolder?.label ?? feed.folderName }
            : feed,
        ),
      );
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
    onSuccess: async ({ feedIds }) => {
      const deletedFeedIdSet = new Set(feedIds);
      queryClient.setQueryData(["feeds", "followed"], (current: FollowedFeed[] | undefined) =>
        current?.filter((feed) => !deletedFeedIdSet.has(feed.feedId)),
      );
      setRowSelection({});
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
    onError: (error) => {
      toastManager.add({
        title: "Unable to remove selected feeds",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        type: "error",
      });
    },
  });

  const tableData = useMemo<FeedRow[]>(() => {
    return (followedFeedsQuery.data ?? []).map((feed) => ({
      id: feed.feedId,
      title: feed.title || feed.url,
      url: feed.url,
      folderId: feed.folderId ?? unsortedFolderId,
      folderName: feed.folderName ?? "Unsorted",
      source: getSourceLabel(feed),
      followedAtLabel: formatDateLabel(feed.subscribedAt),
    }));
  }, [followedFeedsQuery.data, unsortedFolderId]);

  const columns = useMemo(
    () =>
      getManageFeedsColumns({
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
    <Dialog
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
          <ManageFeedsTableFrame
            columnsLength={columns.length}
            isError={followedFeedsQuery.isError}
            isLoading={followedFeedsQuery.isLoading}
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
    </Dialog>
  );
}
