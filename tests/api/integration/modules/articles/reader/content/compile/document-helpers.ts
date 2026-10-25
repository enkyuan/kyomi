import {
  ARTICLE_DOCUMENT_PASSES,
  compileArticleRoot,
  createDraft,
  createLowerContext,
  lowerHtml,
  type ArticleDocumentPassName,
  type DocumentDraft,
} from "@kyomi/worker/document";

export const BASE_URL = "https://example.com/posts/entry";

/** Runs the ingest passes and the lowering pass, returning the draft the Stage C passes consume. */
export function lowerToDraft(
  html: string,
  options: { baseUrl?: string | null; title?: string | null; generator?: string | null } = {},
): DocumentDraft {
  const baseUrl = options.baseUrl === undefined ? BASE_URL : options.baseUrl;
  const { root, context } = compileArticleRoot(html, { baseUrl, generator: options.generator });
  const ctx = createLowerContext();
  const blocks = lowerHtml(root, ctx);
  return createDraft({
    source: { format: "html", origin: "feed_html", baseUrl: context.baseUrl },
    compiler: { version: "test", sanitizerVersion: "test" },
    meta: {
      title: options.title ?? null,
      subtitle: null,
      authors: [],
      siteName: null,
      language: null,
      direction: "auto",
      publishedAt: null,
      updatedAt: null,
      wordCount: 0,
      readingMinutes: 0,
      leadImage: null,
    },
    blocks,
    defs: ctx.defs,
    droppedElements: context.diagnostics.droppedElements,
    hints: ctx.hints,
  });
}

/** Runs the named Stage C passes in the order given. */
export async function runDocumentPasses(
  draft: DocumentDraft,
  ...names: ArticleDocumentPassName[]
): Promise<DocumentDraft> {
  for (const name of names) {
    const pass = ARTICLE_DOCUMENT_PASSES.find((candidate) => candidate.name === name);
    if (!pass) {
      throw new Error(`Unknown document pass ${name}`);
    }
    await pass.run(draft);
  }
  return draft;
}

/** Lowers HTML and runs every pass before `validate`, in order, up to and including `upTo`. */
export async function runThrough(
  html: string,
  upTo: ArticleDocumentPassName,
  options?: Parameters<typeof lowerToDraft>[1],
): Promise<DocumentDraft> {
  const draft = lowerToDraft(html, options);
  const names = ARTICLE_DOCUMENT_PASSES.map((pass) => pass.name);
  return runDocumentPasses(draft, ...names.slice(0, names.indexOf(upTo) + 1));
}
