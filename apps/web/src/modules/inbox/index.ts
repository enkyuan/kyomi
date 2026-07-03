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
} from "./hooks/data";
export {
  useInboxRouteState,
  useMarkReadBehavior,
  useResponsiveReaderMode,
  type InboxLayoutVariant,
} from "./hooks/use-layout";
export { isInboxPathname, prefetchInboxFlow } from "./lib/navigation";
export {
  readInboxArticleOpenBehaviorCookie,
  writeInboxArticleOpenBehaviorCookie,
} from "./lib/layout-persistence";
export { invalidateFeedAndInboxQueries, type InboxListPage } from "./queries/options";
export { getInboxPreferences, updateInboxPreferences } from "./services/preferences";
