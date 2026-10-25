import type { ReaderBodyPayload } from "@/lib/reader-document";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

export type ReaderArticle = ArticleListItemDto & {
  readonly imageUrl: string | null;
  readonly reader: {
    readonly selected: ReaderBodyPayload;
  };
};
