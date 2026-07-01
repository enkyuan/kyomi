"use client";

import { Link } from "@tanstack/react-router";
import { AddFill, Folder2Fill, Settings1Fill } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import type { OrganizerFolder } from "./types";
import { formatFeedCount } from "./utils";
import { OrganizerSection, SectionEmpty } from "./section";

export function FoldersSection({
  folders,
  onCreateFolder,
  onManageFolders,
}: {
  folders: OrganizerFolder[];
  onCreateFolder: () => void;
  onManageFolders: () => void;
}) {
  return (
    <OrganizerSection title="Folders" icon={<Folder2Fill className="size-4" />}>
      {folders.length === 0 ? (
        <SectionEmpty
          title="No folders yet"
          description="Create a folder to group feeds."
          action={
            <Button size="sm" onClick={onCreateFolder}>
              <AddFill />
              Create folder
            </Button>
          }
        />
      ) : (
        <div className="space-y-1">
          {folders.slice(0, 6).map((folder) => (
            <Link
              key={folder.id}
              className="group flex h-11 min-w-0 items-center gap-3 rounded-md px-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              to="/inbox"
              search={(prev) => ({
                ...prev,
                filter: "my-feed" as const,
                folderId: folder.id,
                feedId: undefined,
                itemId: undefined,
                search: undefined,
              })}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                <Folder2Fill className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{folder.name}</span>
                <span className="block truncate text-muted-foreground text-xs">
                  {formatFeedCount(folder.feedCount)}
                </span>
              </span>
            </Link>
          ))}
          <Button
            className="mt-1 w-full justify-start"
            size="sm"
            variant="ghost"
            onClick={onManageFolders}
          >
            <Settings1Fill />
            Manage folders
          </Button>
        </div>
      )}
    </OrganizerSection>
  );
}
