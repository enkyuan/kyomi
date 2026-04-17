"use client";

import { layout, prepare } from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { listFollowedFeeds } from "@lib/feed-functions";
import { listFolders } from "@lib/folder-functions";
import { cn } from "@lib/utils";

const WORKSPACE_SCOPE_FONT = '500 13px "Inter Variable"';
const WORKSPACE_SCOPE_LINE_HEIGHT = 20;

type SidebarWorkspaceHeaderProps = {
  isMac?: boolean;
  isMacPlatform?: boolean;
};

export function SidebarWorkspaceHeader({ isMac, isMacPlatform }: SidebarWorkspaceHeaderProps) {
  const isMacKeyboard = isMacPlatform ?? isMac ?? false;
  const navigate = useNavigate();
  const location = useLocation();
  const [commandOpen, setCommandOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [manageFeedsOpen, setManageFeedsOpen] = useState(false);
  const foldersQuery = useQuery({
    queryKey: ["folders"],
    queryFn: () => listFolders(),
  });
  const followedFeedsQuery = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
  });

  const inboxItems = [
    {
      label: "Today",
      shortcut: "G I",
      icon: Calendar3Fill,
      action: () =>
        navigate({
          to: "/inbox",
          search: (prev) => ({
            ...prev,
            filter: "today" as const,
            search: undefined,
            feedId: undefined,
            folderId: undefined,
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
          search: (prev) => ({
            ...prev,
            filter: "unread" as const,
            search: undefined,
            feedId: undefined,
            folderId: undefined,
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
          search: (prev) => ({
            ...prev,
            filter: "saved" as const,
            search: undefined,
            feedId: undefined,
            folderId: undefined,
            itemId: undefined,
          }),
        }),
    },
  ];

  const folderItems = foldersQuery.data ?? [];
  const feedItems = followedFeedsQuery.data ?? [];
  const currentFeedId = location.pathname === "/inbox" ? location.search.feedId : undefined;
  const currentFolderId = location.pathname === "/inbox" ? location.search.folderId : undefined;
  const currentFeed = currentFeedId
    ? feedItems.find((item) => item.feedId === currentFeedId)
    : undefined;
  const currentFolder = currentFolderId
    ? folderItems.find((folder) => folder.id === currentFolderId)
    : undefined;
  const currentScope = currentFeed
    ? {
        icon: (
          <FeedFavicon
            className="size-4 shrink-0 rounded-sm"
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
                      <WorkspaceScopeLabel label={workspaceLabel} />
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
                              currentFolderId === folder.id &&
                                "bg-accent/72 text-accent-foreground",
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
                            {currentFolderId === folder.id ? (
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
                              currentFeedId === item.feedId &&
                                "bg-accent/72 text-accent-foreground",
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
                              feedUrl={item.url}
                              siteUrl={item.link}
                              title={item.title || item.url}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                            {item.folderName ? (
                              <span
                                className={cn(
                                  "truncate text-xs",
                                  currentFeedId === item.feedId
                                    ? "text-accent-foreground/72"
                                    : "text-muted-foreground",
                                )}
                              >
                                {item.folderName}
                              </span>
                            ) : null}
                            {currentFeedId === item.feedId ? (
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

function WorkspaceScopeLabel({ label }: { label: string }) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const preparedLabel = useMemo(() => prepare(label, WORKSPACE_SCOPE_FONT), [label]);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setAvailableWidth(element.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const fittedLabel = useMemo(() => {
    if (availableWidth <= 0) {
      return label;
    }

    if (layout(preparedLabel, availableWidth, WORKSPACE_SCOPE_LINE_HEIGHT).lineCount <= 1) {
      return label;
    }

    let low = 0;
    let high = label.length;
    let best = "…";

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = `${label.slice(0, mid).trimEnd()}…`;
      const preparedCandidate = prepare(candidate, WORKSPACE_SCOPE_FONT);

      if (layout(preparedCandidate, availableWidth, WORKSPACE_SCOPE_LINE_HEIGHT).lineCount <= 1) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }, [availableWidth, label, preparedLabel]);

  return (
    <span ref={containerRef} className="min-w-0 flex-1 truncate font-medium text-sm">
      {fittedLabel}
    </span>
  );
}
