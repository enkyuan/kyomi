"use client";

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@components/ui/badge";
import { Checkbox } from "@components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
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
import { listFollowedFeeds, type FollowedFeed } from "@lib/feed-functions";

type ManageFeedsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FeedRow = {
  followedAtLabel: string;
  folderName: string;
  id: string;
  source: string;
  title: string;
  url: string;
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

function getColumns(): ColumnDef<FeedRow>[] {
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
      cell: ({ row }) => <Badge variant="outline">{row.original.folderName}</Badge>,
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.source}</span>
      ),
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
  const followedFeedsQuery = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
    enabled: open,
  });

  const tableData = useMemo<FeedRow[]>(() => {
    return (followedFeedsQuery.data ?? []).map((feed) => ({
      id: feed.feedId,
      title: feed.title || feed.url,
      url: feed.url,
      folderName: feed.folderName ?? "Unsorted",
      source: getSourceLabel(feed),
      followedAtLabel: formatDateLabel(feed.subscribedAt),
    }));
  }, [followedFeedsQuery.data]);

  const columns = useMemo(() => getColumns(), []);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage feeds</DialogTitle>
          <DialogDescription>
            Review the feeds in your workspace and the folders they currently belong to.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="pt-0">
          <Frame className="w-full">
            <Table>
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
                  <TableCell colSpan={4}>
                    {selectedCount > 0 ? `${selectedCount} selected` : "Total feeds"}
                  </TableCell>
                  <TableCell className="text-right">{tableData.length}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Frame>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
