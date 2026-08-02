export type OpmlImportStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export type OpmlUrlFailure = {
  url: string;
  code: string;
  message: string;
};

export type OpmlImportCounters = {
  totalUrls: number;
  completed: number;
  subscribed: number;
  alreadySubscribed: number;
  failed: number;
  cancelled: number;
};

export type OpmlImportSummary = OpmlImportCounters & {
  failures: OpmlUrlFailure[];
};

export type OpmlTaskMeta = {
  taskId: string;
  userId: string;
  filename: string;
  opmlTitle: string | null;
  opmlAuthor: string | null;
  status: OpmlImportStatus;
  createdAt: string;
  completedAt: string | null;
  message: string | null;
};

export type OpmlTaskState = OpmlTaskMeta & {
  counters: OpmlImportCounters;
  failures: OpmlUrlFailure[];
};

export type OpmlTaskListItem = {
  taskId: string;
  status: OpmlImportStatus;
  createdAt: string;
  completedAt: string | null;
  summary: Pick<
    OpmlImportSummary,
    "subscribed" | "alreadySubscribed" | "failed" | "totalUrls"
  > | null;
};

export type ParsedOpmlFeed = {
  /** @deprecated Use originalUrl. Kept equal to originalUrl for source compatibility. */
  xmlUrl: string;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  folderName: string;
};

export type ParsedOpmlDocument = {
  opmlTitle: string | null;
  opmlAuthor: string | null;
  feeds: ParsedOpmlFeed[];
};
