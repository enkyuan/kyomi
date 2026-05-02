export type FeedPreviewDto = {
  /** Known feed row id when this URL already exists in `feeds`. */
  id: string | null;
  /** Canonical normalized URL (after redirects). */
  url: string;
  title: string;
  description: string;
  link: string | null;
  isSubscribed: boolean;
};

export type FeedSearchResultDto = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  isSubscribed: boolean;
};
