import type { ReactNode } from "react";
import {
  ArchiveNativeIcon,
  BellOffNativeIcon,
  BookmarkNativeIcon,
  ClockNativeIcon,
  EyeClosedNativeIcon,
  FileArrowLeftInNativeIcon,
  FolderAddLeftNativeIcon,
  FolderOpenNativeIcon,
  HighlightNativeIcon,
  HistoryNativeIcon,
  InboxCheckedNativeIcon,
  LayoutAlignBottomNativeIcon,
  LockNativeIcon,
  MagnifyingGlassNativeIcon,
  PageTextSearchNativeIcon,
  PaperPlaneTopRightNativeIcon,
  PhoneNativeIcon,
  ReceiptBillNativeIcon,
  RssNativeIcon,
  ShieldCrossedNativeIcon,
  TriangleExclamationNativeIcon,
  CloudSimpleDisconnectedNativeIcon,
  type BlodeNativeIcon,
} from "@kyomi/ui/icons/blode-native";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { EmptyState } from "./empty-state";

type EmptyStateContent = {
  /** Blode glyph at the centre of the dashed circle. Omitted for the stacked-paper artwork. */
  readonly icon?: BlodeNativeIcon;
  readonly header: string;
  /** React Native has no `text-wrap: balance`, so the two lines are broken by hand. */
  readonly description: string;
};

/**
 * Every empty state shares one structure: the dashed circle, a glyph (or the stacked paper), a
 * short header and at most two balanced lines of description. Add a variant here, not a new layout.
 */
export const EMPTY_STATES = {
  // Feeds and inbox
  "my-feed": {
    header: "No articles yet",
    description: "New stories will show up here after\nfeeds publish or refresh.",
  },
  "all-feeds": {
    icon: LayoutAlignBottomNativeIcon,
    header: "Nothing to explore yet",
    description: "Stories from across Kyomi will\nappear here as feeds publish.",
  },
  "unread-caught-up": {
    icon: InboxCheckedNativeIcon,
    header: "You're all caught up",
    description: "Nothing unread right now. New\nstories will land here.",
  },
  saved: {
    icon: BookmarkNativeIcon,
    header: "No saved articles yet",
    description: "Save an article and it will\nbe kept here for later.",
  },
  "read-later": {
    icon: ClockNativeIcon,
    header: "Nothing to read later",
    description: "Articles you set aside will\nwait for you here.",
  },
  "folder-empty": {
    icon: FolderOpenNativeIcon,
    header: "This folder is empty",
    description: "No feeds in this folder yet.\nMove one here to fill it.",
  },
  "folders-none": {
    icon: FolderAddLeftNativeIcon,
    header: "No folders yet",
    description: "Create a folder to keep\nrelated feeds together.",
  },
  "sources-none": {
    icon: RssNativeIcon,
    header: "No feeds yet",
    description: "Add a new feed or check out\nExplore to get started.",
  },
  recents: {
    icon: HistoryNativeIcon,
    header: "No recent articles",
    description: "Articles you've opened recently\nwill show up here.",
  },
  // Search
  "search-prompt": {
    icon: MagnifyingGlassNativeIcon,
    header: "Search your feeds",
    description: "Look up articles by title,\nsource, or topic.",
  },
  "search-no-results": {
    icon: PageTextSearchNativeIcon,
    header: "No results found",
    description: "Try a different word or check\nthe spelling.",
  },
  // Settings
  "import-opml": {
    icon: FileArrowLeftInNativeIcon,
    header: "Import OPML",
    description: "Bring your feeds over from another\nreader by importing an OPML file.",
  },
  "settings-notifications-off": {
    icon: BellOffNativeIcon,
    header: "Notifications are off",
    description: "Turn them on in Settings to hear\nabout new stories.",
  },
  "settings-no-devices": {
    icon: PhoneNativeIcon,
    header: "No other devices",
    description: "Devices signed in to your account\nwill be listed here.",
  },
  "settings-billing-no-invoices": {
    icon: ReceiptBillNativeIcon,
    header: "No invoices yet",
    description: "Receipts will show up here after\nyour first payment.",
  },
  "settings-blocked-sources": {
    icon: ShieldCrossedNativeIcon,
    header: "No blocked sources",
    description: "Block a source and its stories\nwon't appear in your feeds.",
  },
  "settings-muted-keywords": {
    icon: EyeClosedNativeIcon,
    header: "No muted keywords",
    description: "Mute a word to hide stories\nthat mention it.",
  },
  "settings-reader-no-highlights": {
    icon: HighlightNativeIcon,
    header: "No highlights yet",
    description: "Passages you highlight while\nreading will be collected here.",
  },
  "settings-advanced-no-data": {
    icon: ArchiveNativeIcon,
    header: "No stored data",
    description: "Cached articles and downloads\nwill be listed here.",
  },
  "settings-feedback-sent": {
    icon: PaperPlaneTopRightNativeIcon,
    header: "Thanks for the feedback",
    description: "We read every note and\nwill follow up if we can.",
  },
  // System
  offline: {
    icon: CloudSimpleDisconnectedNativeIcon,
    header: "You're offline",
    description: "Check your connection and\ntry again in a moment.",
  },
  "load-error": {
    icon: TriangleExclamationNativeIcon,
    header: "Couldn't load this",
    description: "Something went wrong on our end.\nPull down to try again.",
  },
  "permission-denied": {
    icon: LockNativeIcon,
    header: "Access needed",
    description: "Allow access in Settings to\ncontinue with this.",
  },
} as const satisfies Record<string, EmptyStateContent>;

export type EmptyStateVariant = keyof typeof EMPTY_STATES;

type EmptyStateViewProps = {
  variant: EmptyStateVariant;
  /** Replaces the catalog description, e.g. to embed a badge. */
  description?: ReactNode;
  height: number;
  topContentInset: number;
};

/** The shared empty-state layout filled from the catalog. */
export function EmptyStateView({
  variant,
  description,
  height,
  topContentInset,
}: EmptyStateViewProps) {
  const content: EmptyStateContent = EMPTY_STATES[variant];

  return (
    <EmptyState
      asset={<EmptyStateIcon icon={content.icon} size={176} />}
      description={description ?? content.description}
      header={content.header}
      height={height}
      topContentInset={topContentInset}
    />
  );
}
