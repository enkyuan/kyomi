"use client";

import {
  AddFill,
  FileExportFill,
  FileImportFill,
  Folder2Fill,
  Fullscreen2Fill,
  ListCheckFill,
} from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/components/button";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTarget,
  ItemTitle,
} from "@kyomi/ui/components/item";
import type { RecapFolder } from "@modules/inbox/lib/recap/types";
import { RailTooltip, RecapSection, SectionEmpty } from "@modules/inbox/components/recap/sections";
import { formatFeedCount } from "@modules/inbox/lib/recap/index";
import { FolderIconBadge } from "./icon";

export const FOLDER_ACTION_BUTTON_CLASS =
  "h-10 flex-1 gap-1.5 px-4 font-semibold text-sm leading-none sm:h-10 sm:text-sm";
export const FOLDER_ICON_BUTTON_CLASS = "size-10 px-0 sm:size-10";

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
        <Button
          className={FOLDER_ACTION_BUTTON_CLASS}
          shape="pill"
          variant="secondary"
          onClick={onCreateFolder}
        >
          <AddFill className="mx-0 size-4" />
          Add
        </Button>
      </RailTooltip>
      <RailTooltip label="Import OPML">
        <Button
          aria-label="Import OPML"
          className={FOLDER_ACTION_BUTTON_CLASS}
          shape="pill"
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
          shape="pill"
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
          shape="pill"
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
          shape="pill"
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
          shape="pill"
          variant="outline"
          onClick={onAddFolder}
        >
          <AddFill className="mx-0 size-4" />
        </Button>
      </RailTooltip>
    </div>
  );
}

function FolderSummaryItem({
  folder,
  onSelect,
}: {
  folder: RecapFolder;
  onSelect: (folder: RecapFolder) => void;
}) {
  return (
    <Item shape="squircle" size="sm">
      <ItemTarget render={<button type="button" onClick={() => onSelect(folder)} />}>
        <ItemMedia>
          <FolderIconBadge />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{folder.name}</ItemTitle>
          <ItemDescription>{formatFeedCount(folder.feedCount)}</ItemDescription>
        </ItemContent>
      </ItemTarget>
    </Item>
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
              <Fullscreen2Fill />
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
              <FolderSummaryItem key={folder.id} folder={folder} onSelect={onSelectFolder} />
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
