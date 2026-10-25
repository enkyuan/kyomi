import type { ReadingState } from "@modules/articles/resurface/schedule";

export type { ReadingState };

/** KDM only. Not sent on the HTML path. */
export type ReadingBlockAnchor = {
  kind: "block";
  blockIndex: number;
  offset: number;
  fingerprint: string;
};

/** On every article list item and on article detail. Null when no row exists. */
export type ReadingProgressDto = {
  progress: number;
  maxProgress: number;
  state: ReadingState;
  /** Engaged: maxProgress >= 0.05 and activeReadMs >= 20_000. Only engaged rows resurface. */
  engaged: boolean;
  remainingMinutes: number | null;
  lastReadAt: string;
  completedAt: string | null;
};

/** Detail only, for restore. */
export type ReadingPositionDto = {
  progress: number;
  anchor: ReadingBlockAnchor | null;
  contentKey: string;
  updatedAt: string;
};

export type ReadingProgressUpdateBody = {
  progress: number;
  anchor: ReadingBlockAnchor | null;
  contentKey: string;
  sessionId: string;
  sessionActiveMs: number;
  completed: boolean;
  clientUpdatedAt: string;
};
