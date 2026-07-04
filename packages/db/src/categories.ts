/**
 * Normalize a category label to a lowercase ASCII slug per the category schema invariant.
 * Labels with no ASCII alphanumerics fall back to deterministic hex so non-Latin categories
 * still dedupe instead of disappearing.
 */
export function toCategorySlug(label: string): string {
  const asciiSlug = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (asciiSlug) {
    return asciiSlug;
  }

  const normalized = label.normalize("NFKC").trim().toLowerCase();
  if (!/[\p{L}\p{N}]/u.test(normalized)) {
    return "";
  }

  const hex = Array.from(normalized)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("-");
  return `u-${hex}`;
}
