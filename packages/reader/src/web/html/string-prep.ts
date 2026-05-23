import { sanitizeReaderArticleHtml } from "./purify";
import { resolveRelativeAssetUrls } from "./url-resolve";

export function normalizeCaptionText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFigureCaptionSpacing(value: string): string {
  return value
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Many publishers repeat the same string in `img[alt]` and `<figcaption>`.
 * When both match, clear `alt` so the caption is the single visible description
 * and screen readers are not given duplicate announcements.
 */
function normalizeFigureContent(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }
  if (!html.includes("<figure") && !html.includes("<img")) {
    return html;
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  for (const figure of tpl.content.querySelectorAll("figure")) {
    const cap = figure.querySelector("figcaption");
    if (!cap) {
      continue;
    }
    const normalizedCaption = normalizeFigureCaptionSpacing(cap.textContent ?? "");
    cap.textContent = normalizedCaption;
    const capNorm = normalizeCaptionText(normalizedCaption);
    if (!capNorm) {
      continue;
    }
    for (const img of figure.querySelectorAll("img")) {
      img.removeAttribute("width");
      img.removeAttribute("height");
      const altNorm = normalizeCaptionText(img.getAttribute("alt") ?? "");
      if (altNorm && altNorm === capNorm) {
        img.setAttribute("alt", "");
      }
    }
  }

  for (const img of tpl.content.querySelectorAll("img")) {
    img.removeAttribute("width");
    img.removeAttribute("height");
  }

  return tpl.innerHTML;
}

/**
 * When markdown uses inline backticks around a literal `<code>…</code>` fragment
 * (e.g. `` `<code>AllocationRecord</code>` ``), marked emits one outer `<code>` whose
 * text is the entity-encoded tags. Collapse that to a single inline code with the inner text only.
 */
function unwrapRedundantInlineCodeMarkup(html: string): string {
  return html
    .replace(/<code>&lt;code&gt;([\s\S]*?)&lt;\/code&gt;<\/code>/gi, "<code>$1</code>")
    .replace(/<code><code>([\s\S]*?)<\/code><\/code>/gi, "<code>$1</code>");
}

export function prepareArticleHtml(html: string, baseUrl?: string | null): string {
  const normalized = unwrapRedundantInlineCodeMarkup(html);
  const withResolvedUrls = resolveRelativeAssetUrls(normalized, baseUrl);
  const safe = sanitizeReaderArticleHtml(withResolvedUrls);
  return normalizeFigureContent(safe);
}
