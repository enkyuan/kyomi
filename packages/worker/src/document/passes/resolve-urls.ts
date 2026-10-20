import { parseSrcset, serializeSrcset } from "../../sanitization/srcset";
import { resolveHttpUrl, type ArticlePass, type CompileContext } from "../context";

const ANCHOR_PREFIX = "kyomi-";
/** Leaves room for a `-NN` dedupe suffix inside the 64-character anchor limit. */
const MAX_SLUG_LENGTH = 54;

const URL_ATTRIBUTES: Record<string, readonly string[]> = {
  img: ["src"],
  source: ["src"],
  video: ["src", "poster"],
  audio: ["src"],
  iframe: ["src"],
  script: ["src"],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/**
 * Rewrites every id (and legacy `a[name]` target) to a unique `kyomi-` anchor, returning the
 * mapping from each original value to its new anchor.
 */
function rewriteAnchors(root: HTMLElement): Map<string, string> {
  const anchors = new Map<string, string>();
  const used = new Set<string>();

  for (const element of Array.from(root.querySelectorAll("[id], a[name]"))) {
    const original = element.getAttribute("id") ?? element.getAttribute("name") ?? "";
    element.removeAttribute("name");
    if (!original || anchors.has(original)) {
      element.removeAttribute("id");
      continue;
    }

    // An id that already carries the prefix (recompiling stored output) keeps a single prefix.
    const unprefixed = original.startsWith(ANCHOR_PREFIX)
      ? original.slice(ANCHOR_PREFIX.length)
      : original;
    const base = `${ANCHOR_PREFIX}${slugify(unprefixed) || "anchor"}`;
    let anchor = base;
    for (let suffix = 2; used.has(anchor); suffix += 1) {
      anchor = `${base}-${suffix}`;
    }
    used.add(anchor);
    anchors.set(original, anchor);
    element.setAttribute("id", anchor);
  }

  return anchors;
}

function fragmentTarget(href: string, context: CompileContext): string | null {
  if (href.startsWith("#")) {
    return href.slice(1);
  }
  if (!context.baseUrl || !href.includes("#")) {
    return null;
  }
  // A full link back to the same article is an in-page link written the long way.
  try {
    const target = new URL(href, context.baseUrl);
    const base = new URL(context.baseUrl);
    return target.origin === base.origin && target.pathname === base.pathname && target.hash
      ? target.hash.slice(1)
      : null;
  } catch {
    return null;
  }
}

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function resolveLinks(root: HTMLElement, anchors: Map<string, string>, context: CompileContext) {
  for (const link of Array.from(root.querySelectorAll("a[href]"))) {
    const href = link.getAttribute("href")?.trim() ?? "";
    const fragment = fragmentTarget(href, context);
    if (fragment !== null) {
      const anchor = anchors.get(decodeFragment(fragment));
      if (anchor) {
        link.setAttribute("href", `#${anchor}`);
      } else {
        link.removeAttribute("href");
      }
      continue;
    }

    const resolved = resolveHttpUrl(href, context);
    if (resolved) {
      link.setAttribute("href", resolved);
    } else {
      link.removeAttribute("href");
    }
  }
}

function resolveAttribute(element: Element, attribute: string, context: CompileContext) {
  const value = element.getAttribute(attribute);
  if (value === null) {
    return;
  }
  const resolved = resolveHttpUrl(value, context);
  if (resolved) {
    element.setAttribute(attribute, resolved);
  } else {
    element.removeAttribute(attribute);
  }
}

function resolveMedia(root: HTMLElement, context: CompileContext) {
  for (const [tag, attributes] of Object.entries(URL_ATTRIBUTES)) {
    for (const element of Array.from(root.querySelectorAll(tag))) {
      for (const attribute of attributes) {
        resolveAttribute(element, attribute, context);
      }
    }
  }

  for (const element of Array.from(root.querySelectorAll("img[srcset], source[srcset]"))) {
    const candidates = parseSrcset(element.getAttribute("srcset") ?? "").flatMap(
      ({ url, descriptor }) => {
        const resolved = resolveHttpUrl(url, context);
        return resolved ? [{ url: resolved, descriptor }] : [];
      },
    );
    if (candidates.length > 0) {
      element.setAttribute("srcset", serializeSrcset(candidates));
    } else {
      element.removeAttribute("srcset");
    }
  }
}

/**
 * Pass 3. Makes every link and media URL absolute against the article URL, and turns ids into
 * `kyomi-` anchors with in-page links rewritten to match. Links to anchors that do not exist
 * lose their `href`.
 */
export const resolveUrls: ArticlePass = (root, context) => {
  const anchors = rewriteAnchors(root);
  resolveLinks(root, anchors, context);
  resolveMedia(root, context);
};
