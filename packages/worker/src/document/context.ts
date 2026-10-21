import { parseHTML } from "linkedom";

/** Shared state for one compile: the parsing document, the article URL, and drop counts. */
export type CompileContext = {
  document: Document;
  /** Absolute http(s) URL the article was published at, or null when unknown. */
  baseUrl: string | null;
  diagnostics: CompileDiagnostics;
};

/** Mirrors `diagnostics` in the reader document model so Phase 1 can carry it forward. */
export type CompileDiagnostics = {
  /** Source elements removed by compiler passes, keyed by lowercase tag name. */
  droppedElements: Record<string, number>;
  warnings: string[];
};

/** One compiler pass: mutates the article root in place. */
export type ArticlePass = (root: HTMLElement, context: CompileContext) => void;

function normalizeBaseUrl(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) {
    return null;
  }
  try {
    const parsed = new URL(baseUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Parses an article body fragment into a detached root the passes can mutate. */
export function parseArticleFragment(
  html: string,
  options?: { baseUrl?: string | null },
): { root: HTMLElement; context: CompileContext } {
  const { document } = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const root = document.body as HTMLElement;
  root.innerHTML = html;
  return {
    root,
    context: {
      document: document as unknown as Document,
      baseUrl: normalizeBaseUrl(options?.baseUrl),
      diagnostics: { droppedElements: {}, warnings: [] },
    },
  };
}

export function countDropped(context: CompileContext, element: Element): void {
  const tag = element.tagName.toLowerCase();
  context.diagnostics.droppedElements[tag] = (context.diagnostics.droppedElements[tag] ?? 0) + 1;
}

/** Resolves `value` against the article URL; returns null unless the result is http(s). */
export function resolveHttpUrl(value: string, context: CompileContext): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.startsWith("#")) {
    return null;
  }
  try {
    const parsed = new URL(candidate, context.baseUrl ?? undefined);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Replaces an element with its children. */
export function unwrapElement(element: Element): void {
  element.replaceWith(...Array.from(element.childNodes));
}
