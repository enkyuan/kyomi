import {
  normalizeSanitizedArticleRoot,
  sanitizeArticleHtmlFragment,
} from "@kyomi/reader/sanitization";
import type { ArticlePass } from "../context";

/** Links to anchors whose target did not survive sanitizing would point nowhere. */
function dropDanglingFragmentLinks(root: HTMLElement): void {
  const ids = new Set(Array.from(root.querySelectorAll("[id]")).map((element) => element.id));
  for (const link of Array.from(root.querySelectorAll("a[href^='#']"))) {
    if (!ids.has(link.getAttribute("href")!.slice(1))) {
      link.removeAttribute("href");
    }
  }
}

/** Pass 9. Applies the shared article policy, then its value normalization, to the compiled tree. */
export const sanitize: ArticlePass = (root) => {
  root.innerHTML = sanitizeArticleHtmlFragment(root.innerHTML);
  normalizeSanitizedArticleRoot(root);
  dropDanglingFragmentLinks(root);
};
