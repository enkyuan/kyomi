"use client";

import {
  Folder2Fill,
  FolderForbidFill,
  FolderInfoFill,
  FolderWarningFill,
  NewsFill,
  SelectorVerticalLine,
} from "@mingcute/react";
import type { useNavigate } from "@tanstack/react-router";
import { Badge } from "@vols.rss/ui/badge";
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
} from "@vols.rss/ui/command";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@vols.rss/ui/sidebar";
import { SidebarModeAnimatedText } from "@vols.rss/ui/sidebar-mode-animated-text";
import { cn } from "@lib/utils";
import { Dialog as CreateFolderDialog } from "@modules/folders/components/create/dialog";
import { Dialog as ManageFeedsDialog } from "@modules/feeds/components/manage/dialog";
import { SourcesDialog } from "@modules/feeds/components/follow/sources-dialog";
import { FeedFavicon } from "./feed-favicon";
import {
  SIDEBAR_LABEL_FONT,
  SIDEBAR_LABEL_LINE_HEIGHT,
  WORKSPACE_SCOPE_FONT,
  WORKSPACE_SCOPE_FONT_READER_FOCUS,
  WORKSPACE_SCOPE_LINE_HEIGHT,
  WORKSPACE_SCOPE_LINE_HEIGHT_READER_FOCUS,
} from "../lib/constants";
import { navigateToInbox, type WorkspaceInboxCommandItem } from "../lib/navigation";
import type { PlatformState } from "@hooks/use-platform";
import { usePretext } from "@hooks/use-pretext";
import { useWorkspaceHeader } from "../hooks/use-workspace-header";

export function PretextLabel({
  className,
  font = SIDEBAR_LABEL_FONT,
  label,
  lineHeight = SIDEBAR_LABEL_LINE_HEIGHT,
}: {
  className?: string;
  font?: string;
  label: string;
  lineHeight?: number;
}) {
  const { containerRef, fittedLabel } = usePretext({ font, label, lineHeight });

  return (
    <span ref={containerRef} className={cn("min-w-0 flex-1 truncate", className)}>
      {fittedLabel}
    </span>
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
  inboxItems: WorkspaceInboxCommandItem[];
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

type HeaderProps = {
  platform: PlatformState;
  isReaderFocusSidebar?: boolean;
};

export function Header({ platform, isReaderFocusSidebar = false }: HeaderProps) {
  const {
    navigate,
    commandOpen,
    setCommandOpen,
    createFolderOpen,
    setCreateFolderOpen,
    manageFeedsOpen,
    setManageFeedsOpen,
    feedItems,
    folderItems,
    followedFeedsQuery,
    foldersQuery,
    inboxItems,
    onCreateFolder,
    onManageFeeds,
    scope,
    scopedFeedId,
    scopedFolderId,
    workspaceLabel,
  } = useWorkspaceHeader({ platform });

  const scopeIcon =
    scope?.kind === "feed" ? (
      <FeedFavicon
        className="size-4 shrink-0 rounded-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:size-4.5"
        faviconUrl={scope.feed.faviconUrl}
        feedUrl={scope.feed.url}
        siteUrl={scope.feed.link}
        title={scope.feed.title || scope.feed.url}
      />
    ) : scope?.kind === "folder" ? (
      <Folder2Fill className="size-4 shrink-0 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:size-4.5" />
    ) : null;

  return (
    <>
      <SidebarHeader className="gap-2 px-2 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
              <CommandDialogTrigger
                render={
                  <SidebarMenuButton className="h-auto py-2" isActive={Boolean(scope)}>
                    <span className="min-w-0 flex flex-1 items-center gap-2">
                      {scopeIcon}
                      <SidebarModeAnimatedText className="min-w-0 flex-1">
                        <PretextLabel
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
                onCreateFolder={onCreateFolder}
                onManageFeeds={onManageFeeds}
                scopedFeedId={scopedFeedId}
                scopedFolderId={scopedFolderId}
              />
            </CommandDialog>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SourcesDialog platform={platform} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <CreateFolderDialog hideTrigger open={createFolderOpen} onOpenChange={setCreateFolderOpen} />
      <ManageFeedsDialog open={manageFeedsOpen} onOpenChange={setManageFeedsOpen} />
    </>
  );
}
