import {
  normalizeSanitizedArticleRoot,
  sanitizeArticleHtmlFragment,
} from "@kyomi/worker/sanitization";

/** Same article HTML policy as the API sanitizer; runs in the browser. */
export function sanitizeReaderArticleHtml(dirty: string): string {
  if (typeof document === "undefined") {
    throw new Error(
      "@kyomi/reader: sanitizeReaderArticleHtml requires a browser DOM. " +
        "Use `@kyomi/reader/web` from client components (or a Vitest jsdom environment).",
    );
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = sanitizeArticleHtmlFragment(dirty);
  normalizeSanitizedArticleRoot(tpl.content);
  return tpl.innerHTML;
}
