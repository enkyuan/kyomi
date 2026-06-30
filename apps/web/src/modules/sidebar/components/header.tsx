"use client";

import { Folder2Fill, SelectorVerticalLine } from "@mingcute/react";
import { Suspense, useCallback, useEffect, useEffectEvent, useState } from "react";
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/sidebar";
import { SidebarModeAnimatedText } from "@kyomi/ui/sidebar/mode-animated-text";
import { cn } from "@lib/utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@kyomi/ui/input-group";
import { Kbd, KbdGroup } from "@kyomi/ui/kbd";
import { FeedFavicon } from "./feed-favicon";
import { lazyNamed } from "@lib/lazy-named";
import {
  SIDEBAR_LABEL_FONT,
  SIDEBAR_LABEL_LINE_HEIGHT,
  WORKSPACE_SCOPE_FONT,
  WORKSPACE_SCOPE_FONT_READER_FOCUS,
  WORKSPACE_SCOPE_LINE_HEIGHT,
  WORKSPACE_SCOPE_LINE_HEIGHT_READER_FOCUS,
} from "../lib/constants";
import type { PlatformState } from "@hooks/use-platform";
import { isPlatformModifierShortcut } from "@hooks/use-platform";
import { usePretext } from "@hooks/use-pretext";
import { useHeader } from "../hooks/use-header";

function PretextLabel({
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

const SourcesDialog = lazyNamed(
  () => import("@modules/feeds/components/follow/sources-dialog"),
  "SourcesDialog",
);
const WorkspaceCommandDialog = lazyNamed(
  () => import("./workspace-command-dialog"),
  "WorkspaceCommandDialog",
);

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
  } = useHeader({ platform });
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesDialogLoaded, setSourcesDialogLoaded] = useState(false);
  const [workspaceDialogLoaded, setWorkspaceDialogLoaded] = useState(false);

  const preloadSourcesDialog = () => {
    setSourcesDialogLoaded(true);
    void SourcesDialog.preload();
  };

  const setWorkspaceOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setWorkspaceDialogLoaded(true);
        void WorkspaceCommandDialog.preload();
      }
      setCommandOpen(open);
    },
    [setCommandOpen],
  );

  const setSourcesDialogOpen = (open: boolean) => {
    if (open) {
      preloadSourcesDialog();
    }
    setSourcesOpen(open);
  };

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const activeEl = document.activeElement;
    const isInput =
      activeEl &&
      (activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.getAttribute("contenteditable") === "true");

    if (isInput) {
      return;
    }

    const key = event.key.toLowerCase();

    // modifier + K opens Workspace Switcher
    if (
      key === "k" &&
      isPlatformModifierShortcut(event, platform) &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      setWorkspaceOpen(true);
    }

    // single / opens Follow Sources (no modifiers)
    if (
      event.key === "/" &&
      !isPlatformModifierShortcut(event, platform) &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      setSourcesDialogLoaded(true);
      void SourcesDialog.preload();
      setSourcesOpen(true);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
            <SidebarMenuButton
              className="h-auto py-2"
              isActive={Boolean(scope)}
              onClick={() => {
                setWorkspaceOpen(true);
              }}
              onFocus={() => {
                setWorkspaceDialogLoaded(true);
                void WorkspaceCommandDialog.preload();
              }}
              onPointerEnter={() => {
                setWorkspaceDialogLoaded(true);
                void WorkspaceCommandDialog.preload();
              }}
            >
              <SelectorVerticalLine className="size-6 shrink-0 -ms-1 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:-ms-0.75" />
              <span className="min-w-0 flex flex-1 items-center gap-2 -ms-1 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:-ms-0.75">
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
              <KbdGroup className="max-sm:hidden opacity-60">
                <Kbd className="bg-sidebar-foreground/6 text-sidebar-foreground/60 shadow-none group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-5">
                  <SidebarModeAnimatedText>{platform.modifierKeyLabel}</SidebarModeAnimatedText>
                </Kbd>
                <Kbd className="bg-sidebar-foreground/6 text-sidebar-foreground/60 shadow-none group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-5">
                  <SidebarModeAnimatedText>K</SidebarModeAnimatedText>
                </Kbd>
              </KbdGroup>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="mt-1 items-stretch overflow-visible rounded-xl p-0 shadow-none transition-shadow duration-150 ease-out hover:bg-transparent active:bg-transparent data-[active=true]:bg-transparent focus-visible:ring-0 focus-within:shadow-[0_0_0_2px_var(--sidebar-ring)] group-data-[reader-focus-sidebar=true]/sidebar-wrapper:gap-0 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:px-0"
              onClick={() => {
                preloadSourcesDialog();
                setSourcesOpen(true);
              }}
              onFocus={preloadSourcesDialog}
              onPointerEnter={preloadSourcesDialog}
            >
              <InputGroup className="h-full min-h-0 w-full rounded-xl border-sidebar-border/70 bg-sidebar-accent/40 shadow-none outline-none ring-0 ring-transparent ring-offset-0 before:hidden transition-[background-color,border-color] hover:bg-sidebar-accent/56 has-[input:focus-visible,textarea:focus-visible]:border-sidebar-border/70 has-[input:focus-visible,textarea:focus-visible]:shadow-none has-[input:focus-visible,textarea:focus-visible]:ring-0! has-[input:focus-visible,textarea:focus-visible]:ring-transparent! dark:has-[input:focus-visible,textarea:focus-visible]:ring-0!">
                <InputGroupInput
                  aria-label="Discover"
                  size="sm"
                  className="cursor-text text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/56 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-base group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-6"
                  placeholder="Follow sources"
                  readOnly
                  type="search"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="ms-auto h-full items-center self-stretch has-[>kbd:last-child]:me-0"
                >
                  <KbdGroup className="-me-0.5">
                    <Kbd className="bg-sidebar-foreground/6 text-sidebar-foreground/60 shadow-none group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-5">
                      <SidebarModeAnimatedText>{"\u002F"}</SidebarModeAnimatedText>
                    </Kbd>
                  </KbdGroup>
                </InputGroupAddon>
              </InputGroup>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <Suspense fallback={null}>
        {workspaceDialogLoaded ? (
          <WorkspaceCommandDialog
            commandOpen={commandOpen}
            createFolderOpen={createFolderOpen}
            feedItems={feedItems}
            followedFeedsQuery={followedFeedsQuery}
            folderItems={folderItems}
            foldersQuery={foldersQuery}
            inboxItems={inboxItems}
            manageFeedsOpen={manageFeedsOpen}
            navigate={navigate}
            onClose={() => {
              setCommandOpen(false);
            }}
            onCommandOpenChange={setWorkspaceOpen}
            onCreateFolder={onCreateFolder}
            onCreateFolderOpenChange={setCreateFolderOpen}
            onManageFeeds={onManageFeeds}
            onManageFeedsOpenChange={setManageFeedsOpen}
            scopedFeedId={scopedFeedId}
            scopedFolderId={scopedFolderId}
          />
        ) : null}
        {sourcesDialogLoaded ? (
          <SourcesDialog
            enableGlobalShortcut={false}
            hideTrigger
            open={sourcesOpen}
            onOpenChange={setSourcesDialogOpen}
            platform={platform}
          />
        ) : null}
      </Suspense>
    </>
  );
}
