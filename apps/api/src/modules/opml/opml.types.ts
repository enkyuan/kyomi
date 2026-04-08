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
  status: "completed";
  createdAt: string;
  completedAt: string;
  summary: OpmlImportSummary;
};

export type OpmlOutlineEntry = {
  xmlUrl: string;
  title?: string;
};
