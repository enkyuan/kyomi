import type { InboxItem } from "./index";

const ARTICLE_SLUG_ID_SEPARATOR = "--";
const DEFAULT_ARTICLE_SLUG = "article";
const MAX_ARTICLE_SLUG_LENGTH = 80;

function slugifyArticleTitle(title: string) {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ARTICLE_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || DEFAULT_ARTICLE_SLUG;
}

export function buildInboxItemSlug(item: Pick<InboxItem, "id" | "title">) {
  return `${item.id}${ARTICLE_SLUG_ID_SEPARATOR}${slugifyArticleTitle(item.title)}`;
}

export function getInboxItemIdFromSlug(slug: string | undefined) {
  if (!slug) {
    return undefined;
  }

  const separatorIndex = slug.indexOf(ARTICLE_SLUG_ID_SEPARATOR);
  if (separatorIndex <= 0) {
    return undefined;
  }

  return slug.slice(0, separatorIndex);
}
