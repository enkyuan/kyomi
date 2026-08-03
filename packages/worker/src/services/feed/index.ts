export { runFeedRefresh, shouldEnrichInsertedItems } from "./refresh";
export { parseFeedDocument } from "./parse";
export { discoverFeedUrlFromHtml } from "./discover-url";
export { FEED_FETCH_ACCEPT, fetchFeedDocument } from "./fetch";
export {
  canonicalWinsOnConflictSql,
  hasExplicitFeedCategories,
  syncInferredFeedCategories,
  syncItemInferences,
  type ClassifierModelInfo,
} from "./categories";
export {
  CATEGORY_CLASSIFIER_PROVENANCE,
  CLASSIFIER_TAXONOMY_VERSION,
  EMBEDDING_CLASSIFIER_METHOD,
  EMBEDDING_CLASSIFIER_MODEL_ID,
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
  MISCELLANEOUS_CATEGORY_LABEL,
} from "./taxonomy";
export {
  classifyFeedCategories,
  classifyItemCategories,
  isMixedFeedHost,
  MAX_CLASSIFIER_LABELS,
  shouldSuppressFallback,
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
  classifyFeedEmbedding,
  classifyItemEmbedding,
  classifyItemEmbeddings,
  embeddingModelInfo,
  embedTexts,
  resetPrototypeCache,
  type EmbeddingClassifierConfig,
  type FeedItemEmbeddingBatchInput,
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
