import type { ClassifierModelInfo, EmbeddingClassifierConfig } from "@kyomi/ingest";

export type BackfillClassifierMethod = "keyword" | "embedding";

export type BackfillClassifier =
  | {
      method: "keyword";
      model: ClassifierModelInfo;
    }
  | {
      method: "embedding";
      model: ClassifierModelInfo;
      embeddingConfig: EmbeddingClassifierConfig;
    };

export type BackfillArgs = {
  apply: boolean;
  all: boolean;
  limit: number;
  batchSize: number;
  itemLimit: number | null;
  feedId: string | null;
  classifier: BackfillClassifierMethod;
  recentDays: number | null;
  normalizeExisting: boolean;
  retryFailed: boolean;
};

export type BackfillStats = {
  apply: boolean;
  classifierMethod: BackfillClassifierMethod;
  classifierModelId: string;
  feedsScanned: number;
  feedsWithClassifierCategories: number;
  feedClassifierFallbacksSuppressed: number;
  feedsFailed: number;
  itemsScanned: number;
  itemsWithClassifierCategories: number;
  itemClassifierAbstentions: number;
  feedBackfillStatusesRecorded: number;
  normalizedExistingAssignments: boolean;
  assignmentsScanned: number;
  assignmentsRewritten: number;
  assignmentsDroppedUnmapped: number;
  itemEmbeddingFailures: number;
};

export type BackfillFeedRow = {
  title: string;
  description: string | null;
  url: string;
  link: string | null;
  sourceKind: string | null;
};

export type BackfillFeedRecord = BackfillFeedRow & { id: string };

export type BackfillItemRow = {
  title: string;
  summary: string | null;
  contentText: string | null;
  /** Set only when source-page extraction is ready. */
  extractedContentText?: string | null;
  link: string | null;
  canonicalUrl: string;
};

export type BackfillItemRecord = BackfillItemRow & { id: string };

/** An item as the batch loader returns it, tagged with the feed it belongs to. */
export type BackfillFeedItemRecord = BackfillItemRecord & { feedId: string };

/** What one feed's run counted; folded into `BackfillStats` and stored as its coverage row. */
export type ProcessedFeedStats = {
  feedClassifierCategories: number;
  feedClassifierFallbackSuppressed: boolean;
  itemsScanned: number;
  itemsWithClassifierCategories: number;
  itemClassifierAbstentions: number;
};

export const BACKFILL_STATUS_PROCESSED = "processed";
export const BACKFILL_STATUS_FAILED = "failed";
