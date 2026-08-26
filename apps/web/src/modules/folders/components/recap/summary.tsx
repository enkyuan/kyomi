"use client";

import {
  AddFill,
  FileExportFill,
  FileImportFill,
  Folder2Fill,
  ListCheckFill,
  RightFill,
} from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/button";
import type { RecapFolder } from "@modules/folders/lib/types";
import { RailTooltip, RecapSection, SectionEmpty } from "@modules/inbox/components/recap/sections";
import { formatFeedCount } from "@modules/inbox/lib/recap/index";
import { FolderIconBadge } from "./folder-icon";

export const FOLDER_ACTION_BUTTON_CLASS =
  "h-10 flex-1 gap-1.5 rounded-full px-4 font-semibold text-sm leading-none before:rounded-full transition-transform active:scale-[0.96] sm:h-10 sm:text-sm";
export const FOLDER_ICON_BUTTON_CLASS =
  "size-10 rounded-full px-0 before:rounded-full transition-transform active:scale-[0.96] sm:size-10";

export function FolderActions({
  exportingOpml = false,
  onCreateFolder,
  onExportOpml,
  onImportOpml,
}: {
  exportingOpml?: boolean;
  onCreateFolder: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
}) {
  return (
    <div className="mt-3 grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 px-1">
      <RailTooltip label="Create folder">
        <Button className={FOLDER_ACTION_BUTTON_CLASS} variant="secondary" onClick={onCreateFolder}>
          <AddFill className="mx-0 size-4" />
          Add
        </Button>
      </RailTooltip>
      <RailTooltip label="Import OPML">
        <Button
          aria-label="Import OPML"
          className={FOLDER_ACTION_BUTTON_CLASS}
          variant="secondary"
          onClick={onImportOpml}
        >
          <FileImportFill className="mx-0 size-4" />
          Import
        </Button>
      </RailTooltip>
      <RailTooltip label="Export OPML">
        <Button
          aria-label="Export OPML"
          className={FOLDER_ICON_BUTTON_CLASS}
          loading={exportingOpml}
          variant="outline"
          onClick={onExportOpml}
        >
          <FileExportFill className="mx-0 size-4" />
        </Button>
      </RailTooltip>
    </div>
  );
}

function FolderSummaryActions({
  onAddFolder,
  onImportOpml,
  onManageFolders,
}: {
  onAddFolder: () => void;
  onImportOpml: () => void;
  onManageFolders: () => void;
}) {
  return (
    <div className="mt-auto grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 px-1 pt-3">
      <RailTooltip label="Manage folders">
        <Button
          className={FOLDER_ACTION_BUTTON_CLASS}
          variant="secondary"
          onClick={onManageFolders}
        >
          <ListCheckFill className="mx-0 size-4" />
          Manage
        </Button>
      </RailTooltip>
      <RailTooltip label="Import OPML">
        <Button
          aria-label="Import OPML"
          className={FOLDER_ACTION_BUTTON_CLASS}
          variant="secondary"
          onClick={onImportOpml}
        >
          <FileImportFill className="mx-0 size-4" />
          Import
        </Button>
      </RailTooltip>
      <RailTooltip label="Create folder">
        <Button
          aria-label="Create folder"
          className={FOLDER_ICON_BUTTON_CLASS}
          variant="outline"
          onClick={onAddFolder}
        >
          <AddFill className="mx-0 size-4" />
        </Button>
      </RailTooltip>
    </div>
  );
}

export function Folders({
  folders,
  onExpand,
  onCreateFolder,
  onImportOpml,
  onSelectFolder,
}: {
  folders: RecapFolder[];
  onExpand: () => void;
  onCreateFolder: () => void;
  onImportOpml: () => void;
  onSelectFolder: (folder: RecapFolder) => void;
}) {
  return (
    <RecapSection
      action={
        folders.length > 0 ? (
          <RailTooltip label="View folders">
            <Button aria-label="View folders" size="icon-xs" variant="ghost" onClick={onExpand}>
              <RightFill />
            </Button>
          </RailTooltip>
        ) : null
      }
      title="Folders"
    >
      {folders.length === 0 ? (
        <SectionEmpty
          title="No folders yet"
          description="Create a folder to group feeds."
          icon={<Folder2Fill />}
          action={
            <Button size="sm" onClick={onCreateFolder}>
              <AddFill />
              Create folder
            </Button>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 space-y-3 overflow-hidden">
            {folders.slice(0, 3).map((folder) => (
              <button
                key={folder.id}
                className="group flex min-h-10 w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl py-1 ps-2 pe-1 text-left text-base outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                type="button"
                onClick={() => onSelectFolder(folder)}
              >
                <FolderIconBadge />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{folder.name}</span>
                  <span className="block truncate text-muted-foreground text-sm">
                    {formatFeedCount(folder.feedCount)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <FolderSummaryActions
            onAddFolder={onCreateFolder}
            onImportOpml={onImportOpml}
            onManageFolders={onExpand}
          />
        </div>
      )}
    </RecapSection>
  );
}
