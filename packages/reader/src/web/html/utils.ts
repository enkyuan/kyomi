export function cn(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

export function hasOnlyElementOrWhitespace(parent: Element, element: Element): boolean {
  for (const child of Array.from(parent.childNodes)) {
    if (child === element) {
      continue;
    }
    if (child.nodeType === Node.TEXT_NODE && !(child.textContent ?? "").trim()) {
      continue;
    }
    return false;
  }
  return true;
}

export function isLikelyTextOrLinkParagraph(p: HTMLElement): boolean {
  if (p.querySelector("img, figure, table, pre, ul, ol, div, section, article")) {
    return false;
  }
  if (!(p.textContent ?? "").trim()) {
    return false;
  }
  return true;
}
