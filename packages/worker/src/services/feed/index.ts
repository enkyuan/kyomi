export { runFeedRefresh, shouldEnrichInsertedItems } from "./refresh";
export { parseFeedDocument } from "./parse";
export { discoverFeedUrlFromHtml } from "./discover-url";
export {
  canonicalWinsOnConflictSql,
  hasExplicitFeedCategories,
  syncInferredFeedCategories,
  type ClassifierModelInfo,
} from "./categories";
export {
  CATEGORY_CLASSIFIER_PROVENANCE,
  CLASSIFIER_TAXONOMY_VERSION,
  EMBEDDING_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
  MISCELLANEOUS_CATEGORY_LABEL,
} from "./taxonomy";
export {
  classifyFeedCategories,
  classifyFeedItemCategories,
  isMixedFeedHost,
  MAX_CLASSIFIER_LABELS,
  shouldSuppressClassifierFeedFallback,
  type CategoryClassification,
  type FeedCategoryClassificationInput,
  type FeedItemCategoryClassificationInput,
  type InferredCategoryLabel,
} from "./classifier";
export {
  createHostRateLimiter,
  createMemoryHostRateLimitStore,
  createRedisHostRateLimitStore,
} from "./host-limit";
export {
  classifyFeedCategoriesByEmbedding,
  classifyFeedItemCategoriesByEmbedding,
  embedTexts,
  resetCategoryPrototypeCacheForTests,
  type EmbeddingClassifierConfig,
} from "./embeddings";
export { buildArticleIdentity, normalizeArticleUrl } from "../../lib/article-identity";
export { decodeHtmlEntities } from "../../lib/html-entities";
export type {
  FeedIngestDatabase,
  FeedRefreshCategoryStats,
  FeedRefreshResult,
  HostRateLimiter,
  HtmlFeedFailureClass,
  SearchSyncConfig,
} from "./types";
