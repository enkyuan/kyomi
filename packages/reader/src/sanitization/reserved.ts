const RESERVED_ATTRIBUTE_PREFIX = "data-kyomi-";
const RESERVED_TAG_PREFIX = "KYOMI-";

/**
 * Removes `data-kyomi-*` attributes and unwraps `kyomi-*` elements. Only the compiler may write
 * them, so this runs on any HTML that is not known compiler output: at the start of a compile, and
 * on read paths for rows whose stored sanitizer version is not current.
 */
export function stripReservedArticleMarkup(root: ParentNode): void {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith(RESERVED_ATTRIBUTE_PREFIX)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  for (const element of Array.from(root.querySelectorAll("*")).reverse()) {
    if (element.tagName.toUpperCase().startsWith(RESERVED_TAG_PREFIX)) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  }
}
