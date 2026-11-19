"use client";

import {
  ChevronRightIcon,
  DotGrid2x3VerticalIcon,
  FileArrowLeftInFilledIcon,
  FileArrowRightOutFilledIcon,
  FilterDescFilledIcon,
  FolderFilledIcon,
  StarFilledIcon,
  StarIcon,
  EditBigFilledIcon,
  BarsThreeFilledIcon,
  PencilIcon,
  PinFilledIcon,
  PinIcon,
  PlusCircleFilledIcon,
} from "@kyomi/ui/icons/blode";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "@kyomi/ui/lib/motion";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@kyomi/ui/components/alert-dialog";
import { Button } from "@kyomi/ui/components/button";
import { CommandItem } from "@kyomi/ui/components/command";
import {
  ContextMenu,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@kyomi/ui/components/context-menu";
import { MenuItem } from "@kyomi/ui/components/menu";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { formatFeedCount } from "../../lib/recap/index";
import { matchesRecapTerm } from "../../lib/recap/command-query";
import type { RecapFolder } from "../../lib/recap/types";
import { useFolderMutations } from "./folders/use-folder-mutations";

export type ManageFoldersProps = {
  exportingOpml: boolean;
  feeds: FollowedFeed[];
  folders: RecapFolder[];
  onCreateFolder: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  moveFeed: (feedId: string, folderId: string) => void;
  onOpenFeed: (feed: FollowedFeed) => void;
};

type FolderSort = "manual" | "name" | "feeds";
const SORT_ORDER: FolderSort[] = ["manual", "name", "feeds"];
const SORT_LABELS: Record<FolderSort, string> = {
  feeds: "Most feeds",
  manual: "Pinned first",
  name: "Name",
};

/**
 * The command menu's folders page, laid out like the main menu: a "Folders" group of rows that open
 * a folder in place as a file tree of its feeds (right-click for rename, pin and delete) and an
 * "Actions" group. The menu's own field
 * (`term`) filters both.
 */
export function ManageFolders({
  exportingOpml,
  feeds,
  folders,
  onCreateFolder,
  onExportOpml,
  onImportOpml,
  moveFeed,
  onOpenFeed,
  editMode,
  pinMode,
  run,
  setEditMode,
  setPinMode,
  term,
}: ManageFoldersProps & {
  editMode: boolean;
  pinMode: boolean;
  run: (action: () => void) => () => void;
  setEditMode: (update: (value: boolean) => boolean) => void;
  setPinMode: (update: (value: boolean) => boolean) => void;
  term: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [sort, setSort] = useState<FolderSort>("manual");
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ dy: number; feedId: string; originId: string | null } | null>(
    null,
  );
  const dragStartY = useRef(0);
  const [deleteTarget, setDeleteTarget] = useState<RecapFolder | null>(null);
  const { deleteMutation, pinMutation, renameMutation } = useFolderMutations({
    onDeleted: () => setDeleteTarget(null),
    onRenamed: () => {
      setEditingId(null);
      setDraftName("");
    },
  });

  const unsortedId = folders.find((folder) => folder.name === "Unsorted")?.id ?? null;
  const toggle = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  const visibleFolders = [...folders]
    .filter((folder) => matchesRecapTerm(folder.name, term))
    .sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sort === "feeds") {
        return b.feedCount - a.feedCount;
      }
      return Number(b.isPinned) - Number(a.isPinned);
    });
  const isOpen = (id: string) => editMode || expandedIds.has(id);
  const nextSort = SORT_ORDER[(SORT_ORDER.indexOf(sort) + 1) % SORT_ORDER.length] ?? "manual";
  const actions = [
    {
      icon: BarsThreeFilledIcon,
      label: editMode ? "Finished editing" : "Edit folders",
      onSelect: () => setEditMode((value) => !value),
      value: "edit-folders",
    },
    {
      icon: StarFilledIcon,
      label: pinMode ? "Finished pinning" : "Pin folders",
      onSelect: () => setPinMode((value) => !value),
      value: "pin-folders",
    },
    {
      icon: FilterDescFilledIcon,
      label: `Sort: ${SORT_LABELS[sort]}`,
      onSelect: () => setSort(nextSort),
      value: "sort-folders",
    },
    {
      icon: PlusCircleFilledIcon,
      label: "Create folder",
      onSelect: run(onCreateFolder),
      value: "create-folder",
    },
    {
      icon: FileArrowLeftInFilledIcon,
      label: "Import OPML",
      onSelect: run(onImportOpml),
      value: "import-opml",
    },
    {
      disabled: exportingOpml,
      icon: FileArrowRightOutFilledIcon,
      label: "Export OPML",
      onSelect: onExportOpml,
      value: "export-opml",
    },
  ].filter((action) => matchesRecapTerm(action.label, term));

  // Feeds move by pointer, in place: the row follows the pointer inside the list (never outside the
  // menu) and drops into whichever other folder it ends over.
  const dragHandlers = (feed: FollowedFeed) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!editMode || event.button !== 0) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartY.current = event.clientY;
      setDrag({ dy: 0, feedId: feed.feedId, originId: feed.folderId ?? unsortedId });
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (drag?.feedId !== feed.feedId) {
        return;
      }
      const bounds = event.currentTarget.closest("[cmdk-list]")?.getBoundingClientRect();
      const y = bounds
        ? Math.min(Math.max(event.clientY, bounds.top), bounds.bottom)
        : event.clientY;
      setDrag({ ...drag, dy: y - dragStartY.current });
      const under = document
        .elementsFromPoint(event.clientX, y)
        .map((element) => element.closest<HTMLElement>("[data-folder-id]")?.dataset.folderId)
        .find((id) => id && id !== drag.originId);
      setDropTargetId(under ?? null);
    },
    onPointerUp: () => {
      if (drag?.feedId === feed.feedId && dropTargetId) {
        moveFeed(feed.feedId, dropTargetId);
      }
      setDrag(null);
      setDropTargetId(null);
    },
    onPointerCancel: () => {
      setDrag(null);
      setDropTargetId(null);
    },
  });

  const submitRename = (folder: RecapFolder) => {
    const name = draftName.trim();
    if (!name || name === folder.name || renameMutation.isPending) {
      return;
    }
    renameMutation.mutate({ folderId: folder.id, name });
  };
  // The menu treats Enter, Escape and the arrows as its own; the rename field keeps them.

  return (
    <>
      {visibleFolders.length > 0 ? (
        <Group label="Folders">
          {visibleFolders.map((folder) =>
            editingId === folder.id ? (
              <div
                key={folder.id}
                className="flex h-10 items-center gap-2.5 px-2.5 font-medium text-sm"
              >
                <FolderFilledIcon className="kyomi-command-item-icon" />
                <InlineRename
                  label={`Rename ${folder.name}`}
                  name={folder.name}
                  onCancel={() => setEditingId(null)}
                  onChange={setDraftName}
                  onSubmit={() => submitRename(folder)}
                />
              </div>
            ) : (
              <ContextMenu key={folder.id}>
                <ContextMenuTrigger
                  render={
                    <div
                      className={
                        dropTargetId === folder.id ? "rounded-2xl bg-accent/70" : undefined
                      }
                      data-folder-id={folder.id}
                    />
                  }
                >
                  <CommandItem
                    aria-expanded={isOpen(folder.id)}
                    value={`folder-${folder.id}`}
                    onSelect={() => toggle(folder.id)}
                  >
                    <FolderGlyph
                      alwaysStar={pinMode}
                      disabled={pinMutation.isPending}
                      folder={folder}
                      onTogglePin={() =>
                        pinMutation.mutate({
                          folderId: folder.id,
                          isPinned: !folder.isPinned,
                          name: folder.name,
                        })
                      }
                    />
                    <span className="min-w-0 truncate">{folder.name}</span>
                    <sup
                      aria-label={formatFeedCount(folder.feedCount)}
                      className="-ms-2.5 self-start pt-2 font-normal text-[10px] text-muted-foreground tabular-nums leading-none"
                    >
                      {folder.feedCount}
                    </sup>
                    {folder.isPinned ? (
                      <PinFilledIcon aria-label="Pinned" className="size-3.5 text-amber-500" />
                    ) : null}
                    <span className="relative ms-auto grid size-5 shrink-0 place-items-center">
                      <ChevronRightIcon
                        aria-hidden="true"
                        className={`absolute size-4 text-muted-foreground transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${isOpen(folder.id) ? "rotate-90" : ""} ${editMode ? "opacity-0" : ""}`}
                      />
                      <button
                        aria-label={`Rename ${folder.name}`}
                        className={`absolute grid size-5 place-items-center rounded-md text-muted-foreground transition-opacity duration-200 ease-out hover:text-foreground motion-reduce:transition-none ${editMode ? "" : "pointer-events-none opacity-0"}`}
                        tabIndex={editMode ? 0 : -1}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingId(folder.id);
                          setDraftName(folder.name);
                        }}
                      >
                        <EditBigFilledIcon className="size-3.5" />
                      </button>
                    </span>
                  </CommandItem>
                  {isOpen(folder.id) ? (
                    <FolderFeeds
                      feeds={feeds.filter((feed) => (feed.folderId ?? unsortedId) === folder.id)}
                      onOpenFeed={run}
                      drag={drag}
                      dragHandlers={dragHandlers}
                      editMode={editMode}
                      open={onOpenFeed}
                    />
                  ) : null}
                </ContextMenuTrigger>
                <ContextMenuPopup className="w-40">
                  <MenuItem
                    onClick={() => {
                      setEditingId(folder.id);
                      setDraftName(folder.name);
                    }}
                  >
                    <PencilIcon />
                    Rename
                  </MenuItem>
                  <MenuItem
                    disabled={pinMutation.isPending}
                    onClick={() =>
                      pinMutation.mutate({
                        folderId: folder.id,
                        isPinned: !folder.isPinned,
                        name: folder.name,
                      })
                    }
                  >
                    {folder.isPinned ? (
                      <PinFilledIcon className="text-amber-500 opacity-100" />
                    ) : (
                      <PinIcon className="text-muted-foreground opacity-70" />
                    )}
                    {folder.isPinned ? "Unpin" : "Pin"}
                  </MenuItem>
                  {folder.name === "Unsorted" ? null : (
                    <MenuItem variant="destructive" onClick={() => setDeleteTarget(folder)}>
                      <span aria-hidden className="size-3" />
                      Delete
                    </MenuItem>
                  )}
                </ContextMenuPopup>
              </ContextMenu>
            ),
          )}
        </Group>
      ) : null}
      {actions.length > 0 ? (
        <Group label="Actions">
          {actions.map(({ disabled, icon: Icon, label, onSelect, value }) => (
            <CommandItem key={value} disabled={disabled} value={value} onSelect={onSelect}>
              <Icon className="kyomi-command-item-icon" />
              {label}
            </CommandItem>
          ))}
        </Group>
      ) : null}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Feeds in {deleteTarget?.name ?? "this folder"} will move to Unsorted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button
              loading={deleteMutation.isPending}
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ folderId: deleteTarget.id });
                }
              }}
            >
              Delete folder
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

/**
 * The folder's name, edited in place: the text itself becomes editable (no input box), marked by a
 * soft highlight and a caret. Enter saves, Escape or clicking away cancels.
 */
function InlineRename({
  label,
  name,
  onCancel,
  onChange,
  onSubmit,
}: {
  label: string;
  name: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  return (
    <span
      ref={ref}
      aria-label={label}
      className="-mx-1.5 min-w-0 flex-1 truncate rounded-md bg-accent/70 px-1.5 py-0.5 text-foreground caret-foreground outline-none ring-1 ring-ring/40 transition-[background-color,box-shadow] duration-150 ease-out focus:ring-2"
      contentEditable="plaintext-only"
      role="textbox"
      suppressContentEditableWarning
      onBlur={onCancel}
      onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
      onKeyDown={(event) => {
        // The menu treats Enter, Escape and the arrows as its own; the name keeps them.
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
        if (event.key === "Escape") {
          onCancel();
        }
      }}
    >
      {name}
    </span>
  );
}

/**
 * The folder's glyph, which turns into a star on hover: tap it to pin (outline) or unpin (filled,
 * in the palette's amber). Icons swap with the shared recipe: scale 0.25 to 1, opacity and a 4px
 * blur, on a spring with no bounce.
 */
function FolderGlyph({
  alwaysStar,
  disabled,
  folder,
  onTogglePin,
}: {
  alwaysStar: boolean;
  disabled: boolean;
  folder: RecapFolder;
  onTogglePin: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const Star = folder.isPinned ? StarFilledIcon : StarIcon;
  const swap = {
    animate: { filter: "blur(0px)", opacity: 1, scale: 1 },
    exit: reduced ? { opacity: 0 } : { filter: "blur(4px)", opacity: 0, scale: 0.25 },
    initial: reduced ? { opacity: 0 } : { filter: "blur(4px)", opacity: 0, scale: 0.25 },
    transition: { bounce: 0, duration: 0.3, type: "spring" as const },
  };

  return (
    <LazyMotion features={domAnimation}>
      <button
        aria-label={folder.isPinned ? `Unpin ${folder.name}` : `Pin ${folder.name}`}
        className="relative mx-0.5 grid size-5 shrink-0 place-items-center rounded-md outline-none"
        disabled={disabled}
        type="button"
        onBlur={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePin();
        }}
        onFocus={() => setHovered(true)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {hovered || alwaysStar ? (
            <m.span key="star" className="absolute grid place-items-center" {...swap}>
              <Star
                className={`size-5 ${folder.isPinned ? "text-amber-500" : "text-muted-foreground"}`}
              />
            </m.span>
          ) : (
            <m.span key="folder" className="absolute grid place-items-center" {...swap}>
              <FolderFilledIcon className="size-5 text-muted-foreground" />
            </m.span>
          )}
        </AnimatePresence>
      </button>
    </LazyMotion>
  );
}

/** A folder's feeds, indented to the folder glyph's centre line so they read as files inside it. */
function FolderFeeds({
  feeds,
  drag,
  dragHandlers,
  editMode,
  onOpenFeed: run,
  open,
}: {
  drag: { dy: number; feedId: string } | null;
  dragHandlers: (feed: FollowedFeed) => Record<string, unknown>;
  editMode: boolean;
  feeds: FollowedFeed[];
  onOpenFeed: (action: () => void) => () => void;
  open: (feed: FollowedFeed) => void;
}) {
  if (feeds.length === 0) {
    return <div className="ms-8 px-2.5 py-2 text-muted-foreground text-sm">No feeds</div>;
  }
  return feeds.map((feed) => {
    const dragging = drag?.feedId === feed.feedId;
    return (
      <div
        key={feed.feedId}
        className={`ms-7 touch-none ${dragging ? "relative z-10 rounded-[14px] bg-popover shadow-[0_0_0_1px_var(--border)]" : ""} ${editMode && !dragging ? "cursor-grab" : ""} ${dragging ? "cursor-grabbing" : ""}`}
        style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
        {...(editMode ? dragHandlers(feed) : {})}
      >
        <CommandItem value={`folder-feed-${feed.feedId}`} onSelect={run(() => open(feed))}>
          <FeedFavicon
            className="size-5 shrink-0"
            faviconUrl={feed.faviconUrl}
            feedUrl={feed.url}
            shape="squircle"
            siteUrl={feed.link}
            squircleCornerRadius={5}
            title={feed.title || feed.url}
          />
          <span className="min-w-0 truncate">{feed.title || feed.url}</span>
          <DotGrid2x3VerticalIcon
            aria-hidden="true"
            className={`ms-auto size-4 shrink-0 text-muted-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none ${editMode ? "" : "opacity-0"}`}
          />
        </CommandItem>
      </div>
    );
  });
}

export function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="pb-1">
      <div className="kyomi-command-group-label">{label}</div>
      {children}
    </div>
  );
}
