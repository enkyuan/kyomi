export type OpmlUrlFailure = {
  url: string;
  code: string;
  message: string;
};

export type OpmlImportSummary = {
  subscribed: number;
  alreadySubscribed: number;
  failed: number;
  failures: OpmlUrlFailure[];
  totalUrls: number;
};

export type OpmlTaskPayload = {
  userId: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
  summary: OpmlImportSummary | null;
};

export type OpmlOutlineEntry = {
  xmlUrl: string;
  title?: string;
};
