export * from "./services/api";
export { List, type ListDisplayOptions } from "./components/list";
export { Page } from "./page";

export { formatInboxTimestamp } from "./utils/format-timestamp";
export {
  dedupePagedInboxItemsById,
  InboxPreferencesBootstrapProvider,
  resolveInitialInboxPreferences,
  useInboxItemStateMutation,
  useInboxPreferences,
  useInboxQueries,
  useRecordInboxItemView,
  type InboxItemPatch,
  type InboxPreferences,
} from "./hooks/use-inbox-data";
export {
  useInboxRouteState,
  useMarkReadBehavior,
  useResponsiveReaderMode,
  useSplitPane,
  type InboxLayoutVariant,
} from "./hooks/use-layout";
export { isInboxPathname, prefetchInboxFlow } from "./lib/navigation";
export {
  readInboxArticleOpenBehaviorCookie,
  readInboxSplitPanePercentCookie,
  writeInboxArticleOpenBehaviorCookie,
  writeInboxSplitPanePercentCookie,
} from "./lib/layout-persistence";
export { invalidateFeedAndInboxQueries, type InboxListPage } from "./queries/options";
export { getInboxPreferences, updateInboxPreferences } from "./services/preferences";
