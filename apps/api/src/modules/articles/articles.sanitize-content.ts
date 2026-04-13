import { JSDOM } from "jsdom";

const ALLOWED_TAGS = new Set([
  "a",
  "article",
  "blockquote",
  "br",
  "code",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const DROP_WITH_CONTENT = new Set([
  "aside",
  "button",
  "footer",
  "form",
  "header",
  "iframe",
  "input",
  "nav",
  "noscript",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
]);

function isSafeHref(value: string): boolean {
  try {
    const parsed = new URL(value, "https://example.com");
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeNode(node: Node, document: Document): void {
  if (node.nodeType !== document.ELEMENT_NODE) {
    return;
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();

  if (DROP_WITH_CONTENT.has(tag)) {
    element.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = document.createDocumentFragment();
    while (element.firstChild) {
      fragment.appendChild(element.firstChild);
    }
    element.replaceWith(fragment);
    return;
  }

  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase();
    const value = attr.value.trim();

    if (name.startsWith("on")) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (tag === "a" && name === "href") {
      if (!isSafeHref(value)) {
        element.removeAttribute(attr.name);
      }
      continue;
    }

    if (tag === "img" && (name === "src" || name === "alt" || name === "title")) {
      if (name === "src" && !isSafeHref(value)) {
        element.remove();
      }
      continue;
    }

    if (tag === "code" && name === "class" && /^language-[\w-]+$/.test(value)) {
      continue;
    }

    if (name === "colspan" || name === "rowspan" || name === "scope") {
      continue;
    }

    element.removeAttribute(attr.name);
  }

  for (const child of [...element.childNodes]) {
    sanitizeNode(child, document);
  }
}

export function sanitizeArticleHtml(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;
  const body = document.body;

  for (const child of [...body.childNodes]) {
    sanitizeNode(child, document);
  }

  for (const element of body.querySelectorAll("*")) {
    if (
      element.childNodes.length === 0 &&
      !["br", "hr", "img"].includes(element.tagName.toLowerCase()) &&
      !element.textContent?.trim()
    ) {
      element.remove();
    }
  }

  return body.innerHTML.replace(/\n{3,}/g, "\n\n").trim();
}

export function htmlToText(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;

  for (const element of document.querySelectorAll("br")) {
    element.replaceWith("\n");
  }

  for (const element of document.querySelectorAll(
    "p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, tr",
  )) {
    element.append("\n");
  }

  return document.body.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
}
