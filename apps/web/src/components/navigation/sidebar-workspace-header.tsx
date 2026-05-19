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
import { FeedFavicon } from "@components/navigation/feed-favicon";
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
import { SidebarModeAnimatedText } from "@components/ui/sidebar-mode-animated-text";
import { SidebarPretextLabel } from "@components/navigation/sidebar-pretext-label";
import { Dialog as CreateFolderDialog, listFolders } from "@modules/folders";
import { Dialog as ManageFeedsDialog, listFollowedFeeds, Sidebar } from "@modules/feeds";
import { isInboxPathname } from "@modules/inbox";
import { QUERY_TIMES } from "@lib/query-policies";
import { cn } from "@lib/utils";

const WORKSPACE_SCOPE_FONT = '500 14px "Inter Variable"';
const WORKSPACE_SCOPE_FONT_READER_FOCUS = '500 16px "Inter Variable"';
const WORKSPACE_SCOPE_LINE_HEIGHT = 20;
const WORKSPACE_SCOPE_LINE_HEIGHT_READER_FOCUS = 24;

type SidebarWorkspaceHeaderProps = {
  isMac?: boolean;
  isMacPlatform?: boolean;
  isReaderFocusSidebar?: boolean;
};

type InboxFilter = "inbox" | "saved" | "today" | "unread";

function navigateToInbox(
  navigate: ReturnType<typeof useNavigate>,
  filter: InboxFilter,
  feedId?: string,
  folderId?: string,
) {
  return navigate({
    to: "/inbox",
    search: () => ({
      filter,
      search: undefined,
      feedId,
      folderId,
      itemId: undefined,
    }),
  });
}

function getInboxItems(navigate: ReturnType<typeof useNavigate>) {
  return [
    {
      label: "Today",
      shortcut: "G I",
      icon: Calendar3Fill,
      action: () => navigateToInbox(navigate, "today"),
    },
    {
      label: "All Unread",
      shortcut: "G U",
      icon: NewsFill,
      action: () => navigateToInbox(navigate, "unread"),
    },
    {
      label: "Read Later",
      shortcut: "G S",
      icon: StarFill,
      action: () => navigateToInbox(navigate, "saved"),
    },
  ];
}

export function SidebarWorkspaceHeader({
  isMac,
  isMacPlatform,
  isReaderFocusSidebar = false,
}: SidebarWorkspaceHeaderProps) {
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
  const inboxItems = getInboxItems(navigate);

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
            className="size-4 shrink-0 rounded-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:size-4.5"
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
          icon: (
            <Folder2Fill className="size-4 shrink-0 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:size-4.5" />
          ),
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
                      <SidebarModeAnimatedText className="min-w-0 flex-1">
                        <SidebarPretextLabel
                          className="font-medium text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-base group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-6"
                          font={
                            isReaderFocusSidebar
                              ? WORKSPACE_SCOPE_FONT_READER_FOCUS
                              : WORKSPACE_SCOPE_FONT
                          }
                          label={workspaceLabel}
                          lineHeight={
                            isReaderFocusSidebar
                              ? WORKSPACE_SCOPE_LINE_HEIGHT_READER_FOCUS
                              : WORKSPACE_SCOPE_LINE_HEIGHT
                          }
                        />
                      </SidebarModeAnimatedText>
                    </span>
                    <SelectorVerticalLine className="-me-1 size-6 shrink-0" />
                  </SidebarMenuButton>
                }
              />
              <WorkspaceHeaderCommandContent
                feedItems={feedItems}
                folderItems={folderItems}
                followedFeedsQuery={followedFeedsQuery}
                foldersQuery={foldersQuery}
                inboxItems={inboxItems}
                navigate={navigate}
                onClose={() => {
                  setCommandOpen(false);
                }}
                onCreateFolder={() => {
                  openNestedDialog(setCreateFolderOpen);
                }}
                onManageFeeds={() => {
                  openNestedDialog(setManageFeedsOpen);
                }}
                scopedFeedId={scopedFeedId}
                scopedFolderId={scopedFolderId}
              />
            </CommandDialog>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Sidebar isMacPlatform={isMacKeyboard} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <CreateFolderDialog hideTrigger open={createFolderOpen} onOpenChange={setCreateFolderOpen} />
      <ManageFeedsDialog open={manageFeedsOpen} onOpenChange={setManageFeedsOpen} />
    </>
  );
}

type WorkspaceHeaderCommandContentProps = {
  feedItems: Array<{
    faviconUrl: string | null;
    feedId: string;
    folderName: string | null;
    link: string | null;
    title: string;
    url: string;
  }>;
  folderItems: Array<{ id: string; name: string }>;
  followedFeedsQuery: { isError: boolean; isLoading: boolean };
  foldersQuery: { isError: boolean; isLoading: boolean };
  inboxItems: ReturnType<typeof getInboxItems>;
  navigate: ReturnType<typeof useNavigate>;
  onClose: () => void;
  onCreateFolder: () => void;
  onManageFeeds: () => void;
  scopedFeedId?: string;
  scopedFolderId?: string;
};

function WorkspaceHeaderCommandContent({
  feedItems,
  folderItems,
  followedFeedsQuery,
  foldersQuery,
  inboxItems,
  navigate,
  onClose,
  onCreateFolder,
  onManageFeeds,
  scopedFeedId,
  scopedFolderId,
}: WorkspaceHeaderCommandContentProps) {
  return (
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
                    void navigateToInbox(navigate, "inbox", item.feedId);
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
  );
}
