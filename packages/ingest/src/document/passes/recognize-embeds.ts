import { type ArticlePass, type CompileContext } from "../context";
import { recognizeEmbedUrl, recognizeMastodonUrl, type RecognizedEmbed } from "../embed-providers";

const EMBED_ATTR = "data-kyomi-embed";
const EMBED_URL_ATTR = "data-kyomi-url";

/** Provider blockquotes, each with the attributes that carry the post URL. */
const BLOCKQUOTE_EMBEDS: readonly { selector: string; urlAttributes: readonly string[] }[] = [
  { selector: "blockquote.twitter-tweet", urlAttributes: [] },
  { selector: "blockquote.instagram-media", urlAttributes: ["data-instgrm-permalink"] },
  { selector: "blockquote.tiktok-embed", urlAttributes: ["cite"] },
  { selector: "blockquote.bluesky-embed", urlAttributes: ["data-bluesky-uri"] },
  { selector: "blockquote.mastodon-embed", urlAttributes: ["data-embed-url"] },
  { selector: "blockquote.text-post-media", urlAttributes: ["data-text-post-permalink"] },
];

/** `at://did/app.bsky.feed.post/rkey` → the public post URL. */
function blueskyAtUri(value: string): string | null {
  const post = value.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9]+)$/);
  return post ? `https://bsky.app/profile/${post[1]}/post/${post[2]}` : null;
}

function recognize(value: string | null | undefined): RecognizedEmbed | null {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }
  const atUri = blueskyAtUri(candidate);
  return recognizeEmbedUrl(atUri ?? candidate) ?? recognizeMastodonUrl(candidate);
}

function markFigure(figure: Element, embed: RecognizedEmbed): void {
  figure.setAttribute(EMBED_ATTR, embed.provider);
  figure.setAttribute(EMBED_URL_ATTR, embed.url);
}

function createLink(context: CompileContext, embed: RecognizedEmbed, label: string | null) {
  const link = context.document.createElement("a");
  link.setAttribute("href", embed.url);
  link.textContent = label?.trim() || embed.url;
  return link;
}

/** Reuses an enclosing figure that holds only this embed (WordPress, news CMS wrappers). */
function soleEmbedHost(element: Element): Element | null {
  const host = element.closest("figure");
  if (!host || host.hasAttribute(EMBED_ATTR)) {
    return null;
  }
  return host.querySelectorAll("iframe, blockquote, script[src]").length === 1 ? host : null;
}

function replaceWithLink(element: Element, embed: RecognizedEmbed, context: CompileContext) {
  const link = createLink(context, embed, element.getAttribute("title"));
  const host = soleEmbedHost(element);
  if (host) {
    markFigure(host, embed);
    element.replaceWith(link);
    return;
  }
  const figure = context.document.createElement("figure");
  markFigure(figure, embed);
  figure.append(link);
  element.replaceWith(figure);
}

function wrapBlockquote(blockquote: Element, embed: RecognizedEmbed, context: CompileContext) {
  const host = soleEmbedHost(blockquote);
  if (host) {
    markFigure(host, embed);
    return;
  }
  const figure = context.document.createElement("figure");
  markFigure(figure, embed);
  blockquote.replaceWith(figure);
  figure.append(blockquote);
}

function blockquoteEmbed(blockquote: Element, urlAttributes: readonly string[]) {
  for (const attribute of urlAttributes) {
    const embed = recognize(blockquote.getAttribute(attribute));
    if (embed) {
      return embed;
    }
  }
  // The post link is conventionally the last link (the timestamp) in the quote.
  for (const link of Array.from(blockquote.querySelectorAll("a[href]")).reverse()) {
    const embed = recognize(link.getAttribute("href"));
    if (embed) {
      return embed;
    }
  }
  return null;
}

/** A paragraph holding nothing but a link whose text is its own URL (classic oEmbed markup). */
function bareLinkEmbed(paragraph: Element): RecognizedEmbed | null {
  const link = paragraph.children.length === 1 ? paragraph.firstElementChild : null;
  if (link?.tagName !== "A") {
    return null;
  }
  const text = link.textContent?.trim() ?? "";
  if (paragraph.textContent?.trim() !== text || !/^https?:\/\//i.test(text)) {
    return null;
  }
  return recognizeEmbedUrl(link.getAttribute("href") ?? "");
}

/**
 * Pass 5. Replaces provider iframes, scripts, blockquotes, and bare-link paragraphs with a
 * `figure[data-kyomi-embed][data-kyomi-url]` holding a plain link to the canonical post, so the
 * embed survives sanitizing as something a reader can open. Unrecognized iframes are left for
 * `strip-chrome` to drop.
 */
export const recognizeEmbeds: ArticlePass = (root, context) => {
  for (const frame of Array.from(root.querySelectorAll("iframe[src]"))) {
    const embed = recognize(frame.getAttribute("src"));
    if (embed) {
      replaceWithLink(frame, embed, context);
    }
  }

  for (const script of Array.from(root.querySelectorAll("script[src]"))) {
    const embed = recognizeEmbedUrl(script.getAttribute("src") ?? "");
    if (embed?.provider === "github-gist") {
      replaceWithLink(script, embed, context);
    }
  }

  for (const { selector, urlAttributes } of BLOCKQUOTE_EMBEDS) {
    for (const blockquote of Array.from(root.querySelectorAll(selector))) {
      const embed = blockquoteEmbed(blockquote, urlAttributes);
      if (embed) {
        wrapBlockquote(blockquote, embed, context);
      }
    }
  }

  for (const paragraph of Array.from(root.querySelectorAll("p"))) {
    const embed = bareLinkEmbed(paragraph);
    if (embed) {
      const figure = context.document.createElement("figure");
      markFigure(figure, embed);
      figure.append(createLink(context, embed, null));
      paragraph.replaceWith(figure);
    }
  }
};
