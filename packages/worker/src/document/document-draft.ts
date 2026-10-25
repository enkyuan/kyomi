import type { ReaderBlock, ReaderDocument, ReaderInline } from "@kyomi/reader/document";

/** Several consecutive figures the source presented as one gallery. */
export type GalleryGroup = {
  layout: "grid" | "carousel";
  caption?: ReaderInline[] | undefined;
};

/**
 * Facts the lowering pass knows about a block that the schema cannot hold. Later passes consume
 * them and the validated document never carries them.
 */
export type BlockHint = {
  gallery?: GalleryGroup;
  /** On a figure: the text beside it, which `figures` folds into a `mediaText` block. */
  mediaText?: { position: "start" | "end"; content: ReaderBlock[] };
  /** A paragraph the source labelled as an image caption or credit. */
  role?: "caption" | "credit";
  /** On a code block: the language as the source wrote it, before canonicalization. */
  codeLanguage?: string;
};

/** A footnote or sidenote body found by lowering, waiting for `footnotes` to match references. */
export type DraftFootnote = {
  /** Source anchors this body answers to; a link to any of them is a reference. */
  anchors: string[];
  presentation: "footnote" | "sidenote";
  children: ReaderBlock[];
};

export type DocumentDraft = {
  source: ReaderDocument["source"];
  compiler: ReaderDocument["compiler"];
  meta: ReaderDocument["meta"];
  /** Caller-supplied hero image, used by `normalize` to detect a duplicated first figure. */
  leadImage: ReaderDocument["meta"]["leadImage"];
  blocks: ReaderBlock[];
  defs: DraftFootnote[];
  footnotes: ReaderDocument["footnotes"];
  features: ReaderDocument["features"];
  diagnostics: ReaderDocument["diagnostics"];
  hints: WeakMap<object, BlockHint>;
};

/** One Stage C pass over the draft tree. */
export type DocumentPass = (draft: DocumentDraft) => void | Promise<void>;

export function warn(draft: Pick<DocumentDraft, "diagnostics">, message: string): void {
  const { warnings } = draft.diagnostics;
  if (warnings.length < 50 && !warnings.includes(message)) {
    warnings.push(message);
  }
}

export function createDraft(
  init: Pick<DocumentDraft, "source" | "compiler" | "meta" | "blocks" | "defs"> & {
    droppedElements?: Record<string, number>;
    hints?: WeakMap<object, BlockHint>;
  },
): DocumentDraft {
  return {
    source: init.source,
    compiler: init.compiler,
    meta: init.meta,
    leadImage: init.meta.leadImage,
    blocks: init.blocks,
    defs: init.defs,
    footnotes: [],
    features: { math: false, codeLanguages: [], embedProviders: [] },
    diagnostics: { droppedElements: init.droppedElements ?? {}, htmlBlocks: 0, warnings: [] },
    hints: init.hints ?? new WeakMap(),
  };
}
