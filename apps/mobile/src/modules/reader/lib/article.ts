import type { ReaderContent } from "@kyomi/reader";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

export type ReaderArticle = ArticleListItemDto & {
  readonly imageUrl: string | null;
  readonly reader: {
    readonly selected: ReaderContent;
  };
};
