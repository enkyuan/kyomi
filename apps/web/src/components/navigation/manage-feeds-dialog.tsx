"use client";

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@components/ui/checkbox";
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
import { Frame } from "@components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@components/ui/select";
import { toastManager } from "@components/ui/toast";
import {
  listFollowedFeeds,
  moveFeedsToFolder,
  type FollowedFeed,
  unfollowFeed,
} from "@lib/feed-functions";
import { listFolders } from "@lib/folder-functions";
import { usePinnedFeedIds } from "@hooks/use-pinned-feed-ids";
import { PinFill, PinLine } from "@mingcute/react";

type ManageFeedsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FeedRow = {
  followedAtLabel: string;
  folderId: string | null;
  folderName: string;
  id: string;
  source: string;
  title: string;
  url: string;
};

type FolderOption = {
  label: string;
  value: string;
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getSourceLabel(feed: FollowedFeed) {
  const candidate = feed.link ?? feed.url;

  try {
    return new URL(candidate).hostname.replace(/^www\./, "");
  } catch {
    return candidate;
  }
}

function getColumns({
  folderOptions,
  onMoveToFolder,
  movingFeedId,
  pinnedFeedIdSet,
  onTogglePinned,
}: {
  folderOptions: FolderOption[];
  onMoveToFolder: (feedId: string, folderId: string) => void;
  movingFeedId: string | null;
  pinnedFeedIdSet: Set<string>;
  onTogglePinned: (feedId: string) => void;
}): ColumnDef<FeedRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => {
        const isAllSelected = table.getIsAllPageRowsSelected();
        const isSomeSelected = table.getIsSomePageRowsSelected();

        return (
          <Checkbox
            aria-label="Select all feeds"
            checked={isAllSelected}
            indeterminate={isSomeSelected && !isAllSelected}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(Boolean(value));
            }}
          />
        );
      },
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.title}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => {
            row.toggleSelected(Boolean(value));
          }}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: "Feed",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{row.original.title}</div>
          <div className="truncate text-muted-foreground text-xs">{row.original.url}</div>
        </div>
      ),
    },
    {
      accessorKey: "folderName",
      header: "Folder",
      cell: ({ row }) => {
        const currentFolderId = row.original.folderId ?? folderOptions[0]?.value;
        if (!currentFolderId) {
          return <span className="text-muted-foreground text-sm">{row.original.folderName}</span>;
        }

        return (
          <Select
            aria-label={`Move ${row.original.title} to folder`}
            items={folderOptions}
            value={currentFolderId}
            onValueChange={(nextValue) => {
              if (!nextValue || nextValue === currentFolderId) {
                return;
              }
              onMoveToFolder(row.original.id, nextValue);
            }}
          >
            <SelectTrigger className="w-fit min-w-0 max-w-44" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {folderOptions.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        );
      },
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.source}</span>
      ),
    },
    {
      id: "pinned",
      header: () => <div className="text-center">Pinned</div>,
      cell: ({ row }) => {
        const isPinned = pinnedFeedIdSet.has(row.original.id);
        const isMovingFeed = movingFeedId === row.original.id;

        return (
          <div className="flex justify-center">
            <Button
              aria-label={isPinned ? `Unpin ${row.original.title}` : `Pin ${row.original.title}`}
              disabled={isMovingFeed}
              size="icon-sm"
              variant="ghost"
              onClick={() => onTogglePinned(row.original.id)}
            >
              {isPinned ? (
                <PinFill className="text-amber-500" />
              ) : (
                <PinLine className="text-muted-foreground" />
              )}
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "followedAtLabel",
      header: () => <div className="text-right">Followed</div>,
      cell: ({ row }) => (
        <div className="text-right text-sm text-muted-foreground">
          {row.original.followedAtLabel}
        </div>
      ),
    },
  ];
}

export function ManageFeedsDialog({ open, onOpenChange }: ManageFeedsDialogProps) {
  const [rowSelection, setRowSelection] = useState({});
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
    getRowId: (row) => row.id,
    onRowSelectionChange: setRowSelection,
    state: {
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
          <Frame className="w-full">
            <Table variant="card">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {followedFeedsQuery.isLoading ? (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center text-muted-foreground"
                      colSpan={columns.length}
                    >
                      Loading feeds...
                    </TableCell>
                  </TableRow>
                ) : followedFeedsQuery.isError ? (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center text-muted-foreground"
                      colSpan={columns.length}
                    >
                      Unable to load feeds.
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      key={row.id}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center text-muted-foreground"
                      colSpan={columns.length}
                    >
                      No followed feeds yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={Math.max(1, columns.length - 1)}>
                    {selectedCount > 0 ? `${selectedCount} selected` : "Total feeds"}
                  </TableCell>
                  <TableCell className="text-right">{tableData.length}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Frame>
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
              ? "Deleting..."
              : selectedCount === 1
                ? "Delete selected feed"
                : "Delete selected feeds"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
