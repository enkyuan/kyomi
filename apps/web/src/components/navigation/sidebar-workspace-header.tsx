"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Calendar3Fill,
  Folder2Fill,
  FolderForbidFill,
  FolderInfoFill,
  FolderWarningFill,
  NewsFill,
  SelectorVerticalLine,
  StarFill,
} from "@mingcute/react";
import { CreateFolderDialog } from "@components/navigation/create-folder-dialog";
import { FeedFavicon } from "@components/navigation/feed-favicon";
import { ManageFeedsDialog } from "@components/navigation/manage-feeds-dialog";
import { Badge } from "@components/ui/badge";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
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
} from "@components/ui/command";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { SidebarFeedSearchTrigger } from "@components/navigation/sidebar-feed-search";
import { SidebarPretextLabel } from "@components/navigation/sidebar-pretext-label";
import { listFollowedFeeds } from "@/features/feeds/api";
import { listFolders } from "@/features/folders/api";
import { isInboxPathname } from "@lib/routes/inbox-path";
import { QUERY_TIMES } from "@lib/query-policies";
import { cn } from "@lib/utils";

const WORKSPACE_SCOPE_FONT = '500 14px "Inter Variable"';
const WORKSPACE_SCOPE_LINE_HEIGHT = 20;

type SidebarWorkspaceHeaderProps = {
  isMac?: boolean;
  isMacPlatform?: boolean;
};

export function SidebarWorkspaceHeader({ isMac, isMacPlatform }: SidebarWorkspaceHeaderProps) {
  const isMacKeyboard = isMacPlatform ?? isMac ?? false;
  const navigate = useNavigate();
  const location = useLocation();
  const isInbox = isInboxPathname(location.pathname);
  const scopedFeedId = isInbox ? location.search.feedId : undefined;
  const scopedFolderId = isInbox ? location.search.folderId : undefined;
  const [commandOpen, setCommandOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [manageFeedsOpen, setManageFeedsOpen] = useState(false);
  const foldersQuery = useQuery({
    queryKey: ["folders"],
    queryFn: () => listFolders(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  });
  const followedFeedsQuery = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  });

  /** Inbox quick switches from the command palette always return to full-workspace views. */
  const inboxItems = [
    {
      label: "Today",
      shortcut: "G I",
      icon: Calendar3Fill,
      action: () =>
        navigate({
          to: "/inbox",
          search: () => ({
            filter: "today" as const,
            search: undefined,
            feedId: scopedFeedId,
            folderId: scopedFolderId,
            itemId: undefined,
          }),
        }),
    },
    {
      label: "All Unread",
      shortcut: "G U",
      icon: NewsFill,
      action: () =>
        navigate({
          to: "/inbox",
          search: () => ({
            filter: "unread" as const,
            search: undefined,
            feedId: scopedFeedId,
            folderId: scopedFolderId,
            itemId: undefined,
          }),
        }),
    },
    {
      label: "Read Later",
      shortcut: "G S",
      icon: StarFill,
      action: () =>
        navigate({
          to: "/inbox",
          search: () => ({
            filter: "saved" as const,
            search: undefined,
            feedId: scopedFeedId,
            folderId: scopedFolderId,
            itemId: undefined,
          }),
        }),
    },
  ];

  const folderItems = foldersQuery.data ?? [];
  const feedItems = followedFeedsQuery.data ?? [];
  const currentFeed = scopedFeedId
    ? feedItems.find((item) => item.feedId === scopedFeedId)
    : undefined;
  const currentFolder = scopedFolderId
    ? folderItems.find((folder) => folder.id === scopedFolderId)
    : undefined;
  const currentScope = currentFeed
    ? {
        icon: (
          <FeedFavicon
            className="size-4 shrink-0 rounded-sm"
            faviconUrl={currentFeed.faviconUrl}
            feedUrl={currentFeed.url}
            siteUrl={currentFeed.link}
            title={currentFeed.title || currentFeed.url}
          />
        ),
        label: currentFeed.title || currentFeed.url,
      }
    : currentFolder
      ? {
          icon: <Folder2Fill className="size-4 shrink-0" />,
          label: currentFolder.name,
        }
      : null;
  const workspaceLabel = currentScope?.label ?? "Inbox";
  const openNestedDialog = (openDialog: (open: boolean) => void) => {
    setCommandOpen(false);
    queueMicrotask(() => {
      openDialog(true);
    });
  };

  return (
    <>
      <SidebarHeader className="gap-2 px-2 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
              <CommandDialogTrigger
                render={
                  <SidebarMenuButton className="h-auto py-2" isActive={Boolean(currentScope)}>
                    <span className="min-w-0 flex flex-1 items-center gap-2">
                      {currentScope ? currentScope.icon : null}
                      <SidebarPretextLabel
                        className="font-medium text-sm"
                        font={WORKSPACE_SCOPE_FONT}
                        label={workspaceLabel}
                        lineHeight={WORKSPACE_SCOPE_LINE_HEIGHT}
                      />
                    </span>
                    <SelectorVerticalLine className="-me-1 size-6 shrink-0" />
                  </SidebarMenuButton>
                }
              />
              <CommandDialogPopup>
                <Command>
                  <CommandInput placeholder="Switch feeds..." />
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
                              setCommandOpen(false);
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
                            <span>Loading folders...</span>
                          </CommandItem>
                        ) : null}
                        {foldersQuery.isError ? (
                          <CommandItem disabled value="folders-error">
                            <FolderWarningFill className="me-2 size-4" />
                            <span>Unable to load folders</span>
                          </CommandItem>
                        ) : null}
                        {!foldersQuery.isLoading &&
                        !foldersQuery.isError &&
                        folderItems.length === 0 ? (
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
                              void navigate({
                                to: "/inbox",
                                search: () => ({
                                  filter: "unread" as const,
                                  search: undefined,
                                  folderId: folder.id,
                                  feedId: undefined,
                                  itemId: undefined,
                                }),
                              });
                              setCommandOpen(false);
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
                            <span>Loading feeds...</span>
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
                              void navigate({
                                to: "/inbox",
                                search: () => ({
                                  filter: "today" as const,
                                  search: undefined,
                                  feedId: item.feedId,
                                  folderId: undefined,
                                  itemId: undefined,
                                }),
                              });
                              setCommandOpen(false);
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
                        <CommandItem
                          value="Create folder new folder"
                          onClick={() => {
                            openNestedDialog(setCreateFolderOpen);
                          }}
                        >
                          <span>Create folder</span>
                        </CommandItem>
                        <CommandItem
                          value="Manage feeds feed sources"
                          onClick={() => {
                            openNestedDialog(setManageFeedsOpen);
                          }}
                        >
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
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarFeedSearchTrigger isMacPlatform={isMacKeyboard} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <CreateFolderDialog hideTrigger open={createFolderOpen} onOpenChange={setCreateFolderOpen} />
      <ManageFeedsDialog open={manageFeedsOpen} onOpenChange={setManageFeedsOpen} />
    </>
  );
}
