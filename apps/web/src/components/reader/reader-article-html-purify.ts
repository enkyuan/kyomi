import createDOMPurify from "dompurify";
import {
  getArticleHtmlSanitizeOptions,
  registerArticleHtmlSanitizeHooks,
} from "@cronos/sanitization";

type PurifyInstance = ReturnType<typeof createDOMPurify>;

let cached: PurifyInstance | null = null;
let JSDOMCtor: (typeof import("jsdom"))["JSDOM"] | null = null;

if (import.meta.env.SSR) {
  const { JSDOM } = await import("jsdom");
  JSDOMCtor = JSDOM;
}

function getPurify(): PurifyInstance {
  if (cached) {
    return cached;
  }
  if (!import.meta.env.SSR) {
    cached = createDOMPurify(window);
  } else {
    if (!JSDOMCtor) {
      throw new Error("JSDOM is unavailable during SSR sanitization");
    }
    const { window } = new JSDOMCtor("");
    cached = createDOMPurify(window as unknown as Window & typeof globalThis);
  }
  registerArticleHtmlSanitizeHooks(cached);
  return cached;
}

/** Same policy as the API sanitizer; safe on SSR (JSDOM) and in the browser. */
export function sanitizeReaderArticleHtml(dirty: string): string {
  return getPurify().sanitize(dirty, getArticleHtmlSanitizeOptions());
}
