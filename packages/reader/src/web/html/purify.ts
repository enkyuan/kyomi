import createDOMPurify from "dompurify";
import { getArticleHtmlSanitizeOptions, registerArticleHtmlSanitizeHooks } from "./sanitization";

type PurifyInstance = ReturnType<typeof createDOMPurify>;

let cached: PurifyInstance | null = null;

function getPurify(): PurifyInstance {
  if (cached) {
    return cached;
  }
  if (typeof window === "undefined") {
    throw new Error(
      "@vols.rss/reader: sanitizeReaderArticleHtml requires a browser DOM. " +
        "Use `@vols.rss/reader/web` from client components (or a Vitest jsdom environment). " +
        "For Node-only sanitization, use `@vols.rss/worker/sanitization` with your own JSDOM window.",
    );
  }
  cached = createDOMPurify(window);
  registerArticleHtmlSanitizeHooks(cached);
  return cached;
}

/** Same policy as the API sanitizer; runs in the browser (DOMPurify + `window`). */
export function sanitizeReaderArticleHtml(dirty: string): string {
  return getPurify().sanitize(dirty, getArticleHtmlSanitizeOptions());
}
