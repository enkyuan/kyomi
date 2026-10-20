import { unwrapElement, type ArticlePass } from "../context";

const RESERVED_ATTRIBUTE_PREFIX = "data-kyomi-";
const RESERVED_TAG_PREFIX = "KYOMI-";

/**
 * Pass 2. Only the compiler may write `data-kyomi-*` hints and `kyomi-*` elements, so any that
 * arrive in source HTML are removed before later passes add their own.
 */
export const stripReserved: ArticlePass = (root) => {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith(RESERVED_ATTRIBUTE_PREFIX)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  for (const element of Array.from(root.querySelectorAll("*")).reverse()) {
    if (element.tagName.toUpperCase().startsWith(RESERVED_TAG_PREFIX)) {
      unwrapElement(element);
    }
  }
};
