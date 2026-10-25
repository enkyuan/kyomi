import {
  READER_DOCUMENT_VERSION,
  readerDocumentSchema,
  type ReaderBlock,
  type ReaderDocument,
  type ReaderInline,
} from "@kyomi/reader/document";
import { warn, type DocumentDraft } from "../document-draft";
import { isAllowedFrameUrl } from "../embed-frames";
import { mapAllInlines, walkBlocks } from "../kdm-tree";
import { describeTree } from "./derive";

type Issues = string[];

function checkAnchors(document: ReaderDocument, issues: Issues): Set<string> {
  const anchors = new Set<string>();
  const claim = (anchor: string) => {
    if (anchors.has(anchor)) {
      issues.push(`duplicate-anchor:${anchor}`);
    }
    anchors.add(anchor);
  };
  const visit = (block: ReaderBlock) => block.anchor && claim(block.anchor);
  walkBlocks(document.blocks, visit);
  for (const footnote of document.footnotes) {
    claim(footnote.id);
    walkBlocks(footnote.children, visit);
  }
  return anchors;
}

function checkInlines(
  inlines: readonly ReaderInline[],
  context: { anchors: Set<string>; footnotes: Set<string>; insideLink: boolean },
  issues: Issues,
): void {
  for (const inline of inlines) {
    if (inline.type === "footnoteRef" && !context.footnotes.has(inline.id)) {
      issues.push(`unresolved-footnote-ref:${inline.id}`);
    }
    if (inline.type === "link") {
      if (context.insideLink) {
        issues.push("nested-link");
      }
      if (inline.href.startsWith("#") && !context.anchors.has(inline.href.slice(1))) {
        issues.push(`unresolved-fragment:${inline.href}`);
      }
    }
    if ("children" in inline) {
      checkInlines(
        inline.children,
        { ...context, insideLink: context.insideLink || inline.type === "link" },
        issues,
      );
    }
  }
}

function checkBlock(block: ReaderBlock, issues: Issues): void {
  if (block.type === "embed" && block.frameUrl) {
    if (!isAllowedFrameUrl(block.provider, block.url, block.frameUrl)) {
      issues.push(`embed-frame-not-allowlisted:${block.provider}`);
    }
  }
  if (block.type === "code" && block.highlight) {
    const { styles, lines } = block.highlight;
    const text = lines.map((line) => line.map(([part]) => part).join("")).join("\n");
    if (text !== block.value) {
      issues.push("highlight-text-mismatch");
    }
    if (lines.some((line) => line.some(([, style]) => style >= styles.length))) {
      issues.push("highlight-style-out-of-range");
    }
  }
}

/** Invariants Zod cannot express; returns a short code for each violation. */
export function documentInvariantIssues(document: ReaderDocument): string[] {
  const issues: Issues = [];
  const anchors = checkAnchors(document, issues);
  const footnotes = new Set(document.footnotes.map((footnote) => footnote.id));
  const check = (inlines: ReaderInline[]) => {
    checkInlines(inlines, { anchors, footnotes, insideLink: false }, issues);
    return inlines;
  };
  mapAllInlines(document.blocks, check);
  walkBlocks(document.blocks, (block) => checkBlock(block, issues));
  for (const footnote of document.footnotes) {
    mapAllInlines(footnote.children, check);
    walkBlocks(footnote.children, (block) => checkBlock(block, issues));
  }

  const described = describeTree(document);
  if (JSON.stringify(described.features) !== JSON.stringify(document.features)) {
    issues.push("features-mismatch");
  }
  if (described.htmlBlocks !== document.diagnostics.htmlBlocks) {
    issues.push("html-block-count-mismatch");
  }
  return issues;
}

/**
 * Pass 18. Assembles the draft, parses it with the schema, and checks the invariants. On any
 * failure returns no document and records a warning, so the caller falls back to the HTML body.
 */
export function validate(draft: DocumentDraft): ReaderDocument | null {
  const candidate = {
    version: READER_DOCUMENT_VERSION,
    source: draft.source,
    compiler: draft.compiler,
    meta: draft.meta,
    features: draft.features,
    blocks: draft.blocks,
    footnotes: draft.footnotes,
    diagnostics: draft.diagnostics,
  };
  const parsed = readerDocumentSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    warn(draft, `validation-failed:${issue?.path.join(".") ?? ""}:${issue?.code ?? ""}`);
    return null;
  }
  const issues = documentInvariantIssues(parsed.data);
  if (issues.length > 0) {
    warn(draft, `validation-failed:${issues[0]}`);
    return null;
  }
  return parsed.data;
}
