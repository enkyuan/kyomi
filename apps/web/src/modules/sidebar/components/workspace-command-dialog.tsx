"use client";

import {
  Folder2Fill,
  FolderForbidFill,
  FolderInfoFill,
  FolderWarningFill,
  NewsFill,
} from "@mingcute/react";
import type { useNavigate } from "@tanstack/react-router";
import { Badge } from "@kyomi/ui/badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
  CommandDialogPopup,
} from "@kyomi/ui/command";
import { Dialog as CreateFolderDialog } from "@modules/folders/components/create/dialog";
import { Dialog as ManageFeedsDialog } from "@modules/feeds/components/manage/dialog";
import { FeedFavicon } from "./feed-favicon";
import { navigateToInbox, type WorkspaceInboxCommandItem } from "../lib/navigation";
import { cn } from "@lib/utils";

type FeedItem = {
  faviconUrl: string | null;
  feedId: string;
  folderName: string | null;
  link: string | null;
  title: string;
  url: string;
};

type FolderItem = {
  id: string;
  name: string;
};

type WorkspaceCommandDialogProps = {
  commandOpen: boolean;
  createFolderOpen: boolean;
  feedItems: FeedItem[];
  followedFeedsQuery: { isError: boolean; isLoading: boolean };
  folderItems: FolderItem[];
  foldersQuery: { isError: boolean; isLoading: boolean };
  inboxItems: WorkspaceInboxCommandItem[];
  manageFeedsOpen: boolean;
  navigate: ReturnType<typeof useNavigate>;
  onClose: () => void;
  onCommandOpenChange: (open: boolean) => void;
  onCreateFolder: () => void;
  onCreateFolderOpenChange: (open: boolean) => void;
  onManageFeeds: () => void;
  onManageFeedsOpenChange: (open: boolean) => void;
  scopedFeedId?: string;
  scopedFolderId?: string;
};

export function WorkspaceCommandDialog({
  commandOpen,
  createFolderOpen,
  feedItems,
  followedFeedsQuery,
  folderItems,
  foldersQuery,
  inboxItems,
  manageFeedsOpen,
  navigate,
  onClose,
  onCommandOpenChange,
  onCreateFolder,
  onCreateFolderOpenChange,
  onManageFeeds,
  onManageFeedsOpenChange,
  scopedFeedId,
  scopedFolderId,
}: WorkspaceCommandDialogProps) {
  return (
    <>
      <CommandDialog open={commandOpen} onOpenChange={onCommandOpenChange}>
        <CommandDialogPopup>
          <Command>
            <CommandInput placeholder="Switch feeds…" />
            <CommandPanel>
              <CommandList>
                <CommandEmpty>No matching folders, feeds, or actions.</CommandEmpty>
                <CommandGroup>
                  <CommandGroupLabel>Inbox</CommandGroupLabel>
                  {inboxItems.map((item) => (
                    <CommandItem
                      key={item.label}
                      value={item.label}
                      onClick={() => {
                        void item.action();
                        onClose();
                      }}
                    >
                      <item.icon className="me-2 size-4" />
                      <span>{item.label}</span>
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandGroupLabel>Folders</CommandGroupLabel>
                  {foldersQuery.isLoading ? (
                    <CommandItem disabled value="loading-folders">
                      <FolderInfoFill className="me-2 size-4" />
                      <span>Loading folders…</span>
                    </CommandItem>
                  ) : null}
                  {foldersQuery.isError ? (
                    <CommandItem disabled value="folders-error">
                      <FolderWarningFill className="me-2 size-4" />
                      <span>Unable to load folders</span>
                    </CommandItem>
                  ) : null}
                  {!foldersQuery.isLoading && !foldersQuery.isError && folderItems.length === 0 ? (
                    <CommandItem disabled value="no-folders">
                      <FolderForbidFill className="me-2 size-4" />
                      <span>No folders yet</span>
                    </CommandItem>
                  ) : null}
                  {folderItems.map((folder) => (
                    <CommandItem
                      key={folder.id}
                      value={`${folder.name} folder`}
                      className={cn(
                        scopedFolderId === folder.id && "bg-accent/72 text-accent-foreground",
                      )}
                      onClick={() => {
                        void navigateToInbox(navigate, "today", undefined, folder.id);
                        onClose();
                      }}
                    >
                      <Folder2Fill className="me-2 size-4" />
                      <span>{folder.name}</span>
                      {scopedFolderId === folder.id ? (
                        <Badge className="ms-auto" size="sm" variant="secondary">
                          Current
                        </Badge>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandGroupLabel>Feeds</CommandGroupLabel>
                  {followedFeedsQuery.isLoading ? (
                    <CommandItem disabled value="loading-feeds">
                      <NewsFill className="me-2 size-4" />
                      <span>Loading feeds…</span>
                    </CommandItem>
                  ) : null}
                  {followedFeedsQuery.isError ? (
                    <CommandItem disabled value="feeds-error">
                      <NewsFill className="me-2 size-4" />
                      <span>Unable to load feeds</span>
                    </CommandItem>
                  ) : null}
                  {!followedFeedsQuery.isLoading &&
                  !followedFeedsQuery.isError &&
                  feedItems.length === 0 ? (
                    <CommandItem disabled value="no-feeds">
                      <NewsFill className="me-2 size-4" />
                      <span>No followed feeds</span>
                    </CommandItem>
                  ) : null}
                  {feedItems.map((item) => (
                    <CommandItem
                      key={item.feedId}
                      value={`${item.title} ${item.url} ${item.folderName ?? ""}`}
                      className={cn(
                        scopedFeedId === item.feedId && "bg-accent/72 text-accent-foreground",
                      )}
                      onClick={() => {
                        void navigateToInbox(navigate, "all", item.feedId);
                        onClose();
                      }}
                    >
                      <FeedFavicon
                        className="ms-0.5 me-2 size-4 shrink-0 rounded-sm"
                        faviconUrl={item.faviconUrl}
                        feedUrl={item.url}
                        siteUrl={item.link}
                        title={item.title || item.url}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.folderName ? (
                        <span
                          className={cn(
                            "truncate text-xs",
                            scopedFeedId === item.feedId
                              ? "text-accent-foreground/72"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.folderName}
                        </span>
                      ) : null}
                      {scopedFeedId === item.feedId ? (
                        <Badge className="ms-2" size="sm" variant="secondary">
                          Current
                        </Badge>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandGroupLabel>Actions</CommandGroupLabel>
                  <CommandItem value="Create folder new folder" onClick={onCreateFolder}>
                    <span>Create folder</span>
                  </CommandItem>
                  <CommandItem value="Manage feeds feed sources" onClick={onManageFeeds}>
                    <span>Manage feeds</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <span>Open inbox views, folders, feeds, or organization actions.</span>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
      <CreateFolderDialog
        hideTrigger
        open={createFolderOpen}
        onOpenChange={onCreateFolderOpenChange}
      />
      <ManageFeedsDialog open={manageFeedsOpen} onOpenChange={onManageFeedsOpenChange} />
    </>
  );
}
