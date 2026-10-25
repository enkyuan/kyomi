import { renderHtml } from "@tanstack/markdown/html";
import type { ReaderDocument, ReaderImage } from "@kyomi/reader/document";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/reader/sanitization";
import { compileArticleHtml, compileArticleRoot } from "./compile";
import { createDraft, warn, type DocumentDraft, type DocumentPass } from "./document-draft";
import { code } from "./passes/code";
import { derive } from "./passes/derive";
import { embeds } from "./passes/embeds";
import { figures } from "./passes/figures";
import { footnotes } from "./passes/footnotes";
import { lowerHtml, createLowerContext, httpUrl } from "./passes/lower-html";
import { lowerMarkdown, lowerPlainText } from "./passes/lower-markdown";
import { math } from "./passes/math";
import { normalize } from "./passes/normalize";
import { validate } from "./passes/validate";

/**
 * Compiler version stored with each document. It embeds the sanitizer version, so any sanitizer
 * bump marks stored documents stale without a hand edit; bump `KDM_COMPILER_REVISION` when Stage C
 * output changes for the same input. The document schema has its own `READER_DOCUMENT_VERSION`.
 */
const KDM_COMPILER_REVISION = 1;
export const ARTICLE_COMPILER_VERSION =
  `${ARTICLE_HTML_SANITIZER_VERSION}+kdm.${KDM_COMPILER_REVISION}` as const;

/** Source size above which no document is built; the sanitized HTML body is still produced. */
export const MAX_DOCUMENT_SOURCE_BYTES = 4_000_000;
/** Parsed element count above which no document is built. */
export const MAX_DOCUMENT_SOURCE_NODES = 100_000;

/** Stage C passes 11–17 in run order; `lower` (10) runs before and `validate` (18) after. */
export const ARTICLE_DOCUMENT_PASSES = [
  { name: "figures", run: figures },
  { name: "footnotes", run: footnotes },
  { name: "code", run: code },
  { name: "math", run: math },
  { name: "embeds", run: embeds },
  { name: "normalize", run: normalize },
  { name: "derive", run: derive },
] as const satisfies readonly { name: string; run: DocumentPass }[];

export type ArticleDocumentPassName = (typeof ARTICLE_DOCUMENT_PASSES)[number]["name"];

export type CompileArticleDocumentInput = {
  body: string;
  format?: "html" | "markdown" | "text";
  origin: ReaderDocument["source"]["origin"];
  baseUrl?: string | null;
  /** `<meta name="generator">` of the source site, for publisher adapters. */
  generator?: string | null;
  meta?: {
    title?: string | null;
    subtitle?: string | null;
    siteName?: string | null;
    language?: string | null;
    direction?: "ltr" | "rtl" | "auto";
    publishedAt?: string | null;
    updatedAt?: string | null;
    authors?: { name: string; url?: string }[];
    /** Feed or Open Graph hero image; removed from the body when the article repeats it. */
    leadImage?: { src: string; alt?: string; width?: number; height?: number } | null;
  };
};

export type CompiledArticleDocument = {
  /** Sanitized article HTML, identical to what `compileArticleHtml` returns for the same body. */
  html: string;
  sanitizerVersion: typeof ARTICLE_HTML_SANITIZER_VERSION;
  /** Null when the source is over a size cap or validation failed; see `diagnostics.warnings`. */
  document: ReaderDocument | null;
  compilerVersion: typeof ARTICLE_COMPILER_VERSION;
  documentVersion: ReaderDocument["version"];
  diagnostics: ReaderDocument["diagnostics"];
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainTextHtml(value: string): string {
  return compileArticleHtml(
    value
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("\n"),
  ).html;
}

function leadImageOf(
  lead: NonNullable<CompileArticleDocumentInput["meta"]>["leadImage"],
): ReaderImage | null {
  const src = httpUrl(lead?.src);
  if (!lead || !src) {
    return null;
  }
  return {
    src,
    alt: lead.alt ?? "",
    ...(lead.width && lead.height ? { width: lead.width, height: lead.height } : {}),
  };
}

function mergeDropped(into: Record<string, number>, from: Record<string, number>): void {
  for (const [tag, count] of Object.entries(from)) {
    into[tag] = (into[tag] ?? 0) + count;
  }
}

/**
 * Compiles one article body into sanitized HTML plus a validated Kyomi Document Model tree.
 * Never throws on bad input: a failed or oversized document comes back as `document: null` with
 * a warning, and the HTML body is still returned.
 */
export async function compileArticleDocument(
  input: CompileArticleDocumentInput,
): Promise<CompiledArticleDocument> {
  const format = input.format ?? "html";
  const options = { baseUrl: input.baseUrl ?? null, generator: input.generator ?? null };

  let html: string;
  let blocks: ReturnType<typeof lowerHtml> = [];
  const dropped: Record<string, number> = {};
  const ctx = createLowerContext();
  let baseUrl: string | null = null;
  let skipReason: string | null = null;

  if (new TextEncoder().encode(input.body).length > MAX_DOCUMENT_SOURCE_BYTES) {
    skipReason = "source-too-large";
  }

  if (format === "html") {
    const { root, context } = compileArticleRoot(input.body, options);
    html = root.innerHTML.trim();
    baseUrl = context.baseUrl;
    mergeDropped(dropped, context.diagnostics.droppedElements);
    if (!skipReason && root.querySelectorAll("*").length > MAX_DOCUMENT_SOURCE_NODES) {
      skipReason = "source-too-complex";
    }
    if (!skipReason) {
      blocks = lowerHtml(root, ctx);
    }
  } else if (format === "markdown") {
    const compiled = compileArticleHtml(renderHtml(input.body, { allowHtml: true }), options);
    html = compiled.html;
    baseUrl = options.baseUrl;
    mergeDropped(dropped, compiled.diagnostics.droppedElements);
    if (!skipReason) {
      blocks = lowerMarkdown(input.body, {
        ctx,
        baseUrl,
        sanitizeFragment: (fragment) => {
          const { root, context } = compileArticleRoot(fragment, options);
          mergeDropped(dropped, context.diagnostics.droppedElements);
          return root;
        },
      });
    }
  } else {
    html = plainTextHtml(input.body);
    blocks = skipReason ? [] : lowerPlainText(input.body);
  }

  const meta = input.meta ?? {};
  const draft: DocumentDraft = createDraft({
    source: { format, origin: input.origin, baseUrl },
    compiler: {
      version: ARTICLE_COMPILER_VERSION,
      sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    },
    meta: {
      title: meta.title ?? null,
      subtitle: meta.subtitle ?? null,
      authors: meta.authors ?? [],
      siteName: meta.siteName ?? null,
      language: meta.language ?? null,
      direction: meta.direction ?? "auto",
      publishedAt: meta.publishedAt ?? null,
      updatedAt: meta.updatedAt ?? null,
      wordCount: 0,
      readingMinutes: 0,
      leadImage: leadImageOf(meta.leadImage),
    },
    blocks,
    defs: ctx.defs,
    droppedElements: dropped,
    hints: ctx.hints,
  });

  let document: ReaderDocument | null = null;
  if (skipReason) {
    warn(draft, skipReason);
  } else {
    try {
      for (const pass of ARTICLE_DOCUMENT_PASSES) {
        await pass.run(draft);
      }
      document = validate(draft);
    } catch (error) {
      warn(draft, `compile-failed:${error instanceof Error ? error.name : "unknown"}`);
    }
  }

  return {
    html,
    sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    document,
    compilerVersion: ARTICLE_COMPILER_VERSION,
    documentVersion: 1,
    diagnostics: draft.diagnostics,
  };
}
