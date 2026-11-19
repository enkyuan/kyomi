import type { EmptyStateScene } from "@/components/icons/empty-state-scenes";

export type EmptyStateContent = {
  readonly header: string;
  /** React Native has no `text-wrap: balance`, so the two lines are broken by hand. */
  readonly description: string;
};

/**
 * Every empty state shares one structure: the dashed circle with its own illustration, a
 * short header and at most two balanced lines of description. Add a variant here, not a new layout.
 */
export const EMPTY_STATES = {
  // Feeds and inbox
  "my-feed": {
    header: "No articles yet",
    description: "New stories will show up here after\nfeeds publish or refresh.",
  },
  "all-feeds": {
    header: "Nothing to explore yet",
    description: "Stories from across Kyomi will\nappear here as feeds publish.",
  },
  "unread-caught-up": {
    header: "You're all caught up",
    description: "New stories show up here\nas they arrive.",
  },
  saved: {
    header: "No saved articles yet",
    description: "Save an article and it will\nbe kept here for later.",
  },
  "read-later": {
    header: "Nothing to read later",
    description: "Articles you set aside will\nwait for you here.",
  },
  "folder-empty": {
    header: "This folder is empty",
    description: "No feeds in this folder yet.\nMove one here to fill it.",
  },
  "folders-none": {
    header: "No folders yet",
    description: "Create a folder to keep\nrelated feeds together.",
  },
  "sources-none": {
    header: "No feeds yet",
    description: "Add a feed, or open Explore\nto find one.",
  },
  recents: {
    header: "No recent articles",
    description: "Articles you've opened recently\nwill show up here.",
  },
  // Search
  "search-prompt": {
    header: "Search your feeds",
    description: "Look up articles by title,\nsource, or topic.",
  },
  "search-no-results": {
    header: "No results found",
    description: "Check the spelling or try\na broader word.",
  },
  // Settings
  "import-opml": {
    header: "Import OPML",
    description: "Bring your feeds over from another\nreader by importing an OPML file.",
  },
  "settings-notifications-off": {
    header: "Notifications are off",
    description: "Turn them on in Settings to hear\nabout new stories.",
  },
  "settings-no-devices": {
    header: "No other devices",
    description: "Devices signed in to your account\nwill be listed here.",
  },
  "settings-billing-no-invoices": {
    header: "No invoices yet",
    description: "Receipts will show up here after\nyour first payment.",
  },
  "settings-blocked-sources": {
    header: "No blocked sources",
    description: "Block a source and its stories\nwon't appear in your feeds.",
  },
  "settings-muted-keywords": {
    header: "No muted keywords",
    description: "Mute a word to hide stories\nthat mention it.",
  },
  "settings-reader-no-highlights": {
    header: "No highlights yet",
    description: "Passages you highlight while\nreading will be collected here.",
  },
  "settings-advanced-no-data": {
    header: "No stored data",
    description: "Cached articles and downloads\nwill be listed here.",
  },
  "settings-feedback-sent": {
    header: "Thanks for the feedback",
    description: "We read every note and\nwill follow up if we can.",
  },
  // System
  offline: {
    header: "You're offline",
    description: "Check your connection and\ntry again in a moment.",
  },
  "load-error": {
    header: "Couldn't load this",
    description: "Pull down to try again.",
  },
  "permission-denied": {
    header: "Access needed",
    description: "Allow access in Settings\nto continue.",
  },
} as const satisfies Record<EmptyStateScene, EmptyStateContent>;
