import { type ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@kyomi/ui/checkbox";
import { Button } from "@kyomi/ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@kyomi/ui/select";
import { PinFill, PinLine } from "@mingcute/react";

export type FeedRow = {
  followedAtLabel: string;
  folderId: string | null;
  folderName: string;
  id: string;
  source: string;
  title: string;
  url: string;
};

export type FolderOption = {
  label: string;
  value: string;
};

export function getColumns({
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
