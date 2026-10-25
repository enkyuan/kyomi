import type { ReaderBodyPayload } from "@/lib/reader-document";
import type { ArticleDetailDto, ArticleListItemDto } from "@kyomi/reader/schemas/article";

export type ReaderArticle = ArticleListItemDto & {
  readonly imageUrl: string | null;
  /** Where the user stopped reading, for restore. Null when nothing was recorded. */
  readonly readingPosition?: ArticleDetailDto["readingPosition"];
  readonly reader: {
    readonly selected: ReaderBodyPayload;
  };
};
