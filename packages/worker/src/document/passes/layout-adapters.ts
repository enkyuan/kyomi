import type { CompileContext } from "../context";

/**
 * A publisher adapter rewrites markup that has no generic class signal into the shapes the
 * generic layout rules (and the lowering pass) understand. It runs before the generic capture.
 */
export type LayoutAdapter = {
  name: string;
  matches: (root: HTMLElement, context: CompileContext) => boolean;
  apply: (root: HTMLElement, context: CompileContext) => void;
};

function hostOf(context: CompileContext): string {
  try {
    return context.baseUrl ? new URL(context.baseUrl).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** Ghost bookmark card → a labelled block holding link, description, publisher, thumbnail. */
function rewriteGhostBookmarks(root: HTMLElement, context: CompileContext): void {
  const document = context.document;
  for (const card of Array.from(root.querySelectorAll(".kg-bookmark-card"))) {
    const link = card.querySelector("a[href]");
    if (!link) {
      continue;
    }
    const block = document.createElement("div");
    block.setAttribute("data-kyomi-role", "bookmark");
    const title = document.createElement("a");
    title.setAttribute("href", link.getAttribute("href") ?? "");
    title.textContent = text(link.querySelector(".kg-bookmark-title")) || link.getAttribute("href");
    block.append(title);
    for (const selector of [".kg-bookmark-description", ".kg-bookmark-publisher"]) {
      const value = text(link.querySelector(selector));
      if (value) {
        const paragraph = document.createElement("p");
        paragraph.textContent = value;
        block.append(paragraph);
      }
    }
    const thumbnail = link.querySelector(".kg-bookmark-thumbnail img[src]");
    if (thumbnail) {
      const image = document.createElement("img");
      image.setAttribute("src", thumbnail.getAttribute("src") ?? "");
      image.setAttribute("alt", "");
      block.append(image);
    }
    card.replaceWith(block);
  }
}

/** Ghost toggle card → native `details`. */
function rewriteGhostToggles(root: HTMLElement, context: CompileContext): void {
  for (const toggle of Array.from(root.querySelectorAll(".kg-toggle-card"))) {
    const heading = toggle.querySelector(".kg-toggle-heading-text");
    const content = toggle.querySelector(".kg-toggle-content");
    if (!heading || !content) {
      continue;
    }
    const details = context.document.createElement("details");
    const summary = context.document.createElement("summary");
    summary.textContent = text(heading);
    details.append(summary, ...Array.from(content.childNodes));
    toggle.replaceWith(details);
  }
}

/** Play buttons and the elapsed-time readout are player chrome, not content. */
function dropGhostAudioChrome(root: HTMLElement): void {
  for (const player of Array.from(root.querySelectorAll(".kg-audio-player"))) {
    player.remove();
  }
}

/** The emoji is decoration; the variant colour already says what the callout is. */
function dropGhostCalloutEmoji(root: HTMLElement): void {
  for (const emoji of Array.from(root.querySelectorAll(".kg-callout-emoji"))) {
    emoji.remove();
  }
}

const ghost: LayoutAdapter = {
  name: "ghost",
  matches: (root, context) =>
    /ghost/i.test(context.generator ?? "") || root.querySelector(".kg-card") !== null,
  apply: (root, context) => {
    rewriteGhostBookmarks(root, context);
    rewriteGhostToggles(root, context);
    dropGhostCalloutEmoji(root);
    dropGhostAudioChrome(root);
  },
};

/** WordPress classic captions wrap the image in `div.wp-caption`. */
const wordpress: LayoutAdapter = {
  name: "wordpress",
  matches: (root, context) =>
    /wordpress/i.test(context.generator ?? "") || root.querySelector(".wp-caption") !== null,
  apply: (root, context) => {
    for (const wrapper of Array.from(root.querySelectorAll("div.wp-caption"))) {
      const caption = wrapper.querySelector(".wp-caption-text");
      if (!caption || wrapper.querySelectorAll("img").length !== 1) {
        continue;
      }
      const figure = context.document.createElement("figure");
      for (const name of ["data-kyomi-placement"]) {
        const value = wrapper.getAttribute(name);
        if (value) {
          figure.setAttribute(name, value);
        }
      }
      const figcaption = context.document.createElement("figcaption");
      figcaption.append(...Array.from(caption.childNodes));
      caption.remove();
      figure.append(...Array.from(wrapper.childNodes), figcaption);
      for (const token of (wrapper.getAttribute("class") ?? "").split(/\s+/)) {
        if (/^align/.test(token)) {
          figure.classList.add(token);
        }
      }
      wrapper.replaceWith(figure);
    }
  },
};

/** Substack serves its footnote number as a link plus a sibling content block. */
const substack: LayoutAdapter = {
  name: "substack",
  matches: (root, context) =>
    hostOf(context).endsWith("substack.com") ||
    root.querySelector(".captioned-image-container, .footnote") !== null,
  apply: (root) => {
    for (const container of Array.from(root.querySelectorAll(".captioned-image-container"))) {
      const figure = container.querySelector("figure");
      if (figure && container.children.length === 1) {
        container.replaceWith(figure);
      }
    }
  },
};

export const LAYOUT_ADAPTERS: readonly LayoutAdapter[] = [ghost, wordpress, substack];
