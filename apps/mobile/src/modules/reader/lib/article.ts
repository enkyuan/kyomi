import type { ReaderContent } from "@kyomi/reader";
import type { ArticleListItem } from "@modules/inbox/lib/articles";

export type ReaderArticle = ArticleListItem & {
  readonly imageUrl: string | null;
  readonly reader: {
    readonly selected: ReaderContent;
  };
};
