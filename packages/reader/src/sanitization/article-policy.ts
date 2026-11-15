/**
 * Allowlists for the shared article HTML policy. `article-html.ts` builds the sanitizer from these
 * and validates attribute values after sanitizing.
 */

/**
 * Increment whenever the allowlist, drop-content tags, attribute/class/URL/style rules,
 * image defaults, or empty-element normalization changes output semantics. A persisted
 * row's stored version is compared against this to decide whether a fresh sanitizer pass
 * is required before it can be treated as already-safe.
 */
export const ARTICLE_HTML_SANITIZER_VERSION = "article-html-v3" as const;

/** MathML presentation elements. `annotation-xml` and `maction` stay out: both can carry HTML. */
export const ARTICLE_MATHML_TAGS = [
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mo",
  "mn",
  "ms",
  "mtext",
  "mspace",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "mover",
  "munder",
  "munderover",
  "msqrt",
  "mroot",
  "mstyle",
  "mpadded",
  "mphantom",
  "menclose",
  "mtable",
  "mtr",
  "mtd",
  "mmultiscripts",
  "mprescripts",
] as const;

/** Layout hints captured by compiler pass 7 and read by the lowering pass. */
export const ARTICLE_LAYOUT_HINT_ATTRS = [
  "data-kyomi-placement",
  "data-kyomi-gallery",
  "data-kyomi-media-text",
  "data-kyomi-callout",
  "data-kyomi-role",
] as const;

export const ARTICLE_HTML_ALLOWED_TAGS = [
  "a",
  "abbr",
  "article",
  "aside",
  "audio",
  "b",
  "bdi",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  /* Kept for quote attribution; the compiler drops page footers before sanitizing. */
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "main",
  "mark",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "section",
  "small",
  "source",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
  ...ARTICLE_MATHML_TAGS,
] as const;

/** Attributes allowed on every tag. `id` and `style` are narrowed further after sanitizing. */
export const ARTICLE_HTML_ALLOWED_ATTR = [
  "class",
  "title",
  "lang",
  "dir",
  "id",
  "style",
  "aria-hidden",
  /* Compiler layout hints; `strip-reserved` guarantees only the compiler writes them. */
  ...ARTICLE_LAYOUT_HINT_ATTRS,
] as const;

const MATHML_ATTRS = Object.fromEntries(
  ARTICLE_MATHML_TAGS.map((tag) => [tag, ["mathvariant"]]),
) as Record<string, readonly string[]>;

/** Attributes allowed only on specific tags, merged with the global list by neosanitize. */
export const ARTICLE_HTML_TAG_ATTRS = {
  ...MATHML_ATTRS,
  a: ["href", "rel", "target"],
  img: ["src", "alt", "width", "height", "loading", "decoding", "srcset", "sizes"],
  source: ["src", "srcset", "sizes", "media", "type"],
  video: ["src", "poster", "controls", "preload", "playsinline", "width", "height"],
  audio: ["src", "controls", "preload"],
  td: ["colspan", "rowspan", "align"],
  th: ["colspan", "rowspan", "scope", "align"],
  ol: ["start", "reversed"],
  li: ["value", "data-kyomi-checked"],
  time: ["datetime"],
  del: ["datetime"],
  ins: ["datetime"],
  details: ["open"],
  math: ["xmlns", "display", "mathvariant"],
  annotation: ["encoding"],
  pre: ["data-kyomi-lang", "data-kyomi-filename", "data-kyomi-lines"],
  figure: ["data-kyomi-embed", "data-kyomi-url"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Interactive and page-chrome elements removed together with their content. neosanitize only
 * unwraps disallowed tags, so the compiler enforces this list on the parsed DOM before
 * sanitizing; `footer` is kept when it attributes a `blockquote` or `figure`.
 */
export const ARTICLE_HTML_DROP_CONTENT_TAGS = [
  /* MathML's alternate-markup slot; its HTML content must not leak into the article. */
  "annotation-xml",
  "button",
  "footer",
  "form",
  "iframe",
  "input",
  /* Labels belong to form controls (and Tufte CSS margin toggles); their text is UI, not prose. */
  "label",
  "nav",
  "noscript",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
] as const;

/** Backward-compatible policy name for callers that treat these as forbidden tags. */
export const ARTICLE_HTML_FORBID_TAGS = ARTICLE_HTML_DROP_CONTENT_TAGS;

/** Providers the compiler may record in `figure[data-kyomi-embed]`; matches the reader document model. */
export const ARTICLE_EMBED_PROVIDERS = [
  "youtube",
  "vimeo",
  "x",
  "bluesky",
  "mastodon",
  "threads",
  "instagram",
  "tiktok",
  "spotify",
  "soundcloud",
  "apple-podcasts",
  "github-gist",
  "codepen",
  "codesandbox",
  "loom",
  "figma",
] as const;
