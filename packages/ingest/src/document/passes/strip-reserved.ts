import { stripReservedArticleMarkup } from "@kyomi/reader/sanitization";
import type { ArticlePass } from "../context";

/**
 * Pass 2. Only the compiler may write `data-kyomi-*` hints and `kyomi-*` elements, so any that
 * arrive in source HTML are removed before later passes add their own.
 */
export const stripReserved: ArticlePass = (root) => {
  stripReservedArticleMarkup(root);
};
