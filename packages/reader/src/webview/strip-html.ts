import { replaceSpans } from "../shared/scan";

const SCRIPT_OPEN = /<script\b/gi;

/**
 * Removes `<script\b[^>]*\/>`. The tag ends at the first `>` after the name, so one cached
 * position serves every opener before it.
 */
function stripSelfClosingScripts(html: string): string {
  let out = "";
  let cursor = 0;
  let tagEnd = -1;
  SCRIPT_OPEN.lastIndex = 0;
  for (let open = SCRIPT_OPEN.exec(html); open; open = SCRIPT_OPEN.exec(html)) {
    if (tagEnd < SCRIPT_OPEN.lastIndex) {
      tagEnd = html.indexOf(">", SCRIPT_OPEN.lastIndex);
      if (tagEnd === -1) {
        break;
      }
    }
    if (html[tagEnd - 1] === "/") {
      out += html.slice(cursor, open.index);
      cursor = tagEnd + 1;
      SCRIPT_OPEN.lastIndex = cursor;
    }
  }
  return out + html.slice(cursor);
}

/**
 * Lightweight hardening for WebView HTML strings (no full DOM parser).
 * API `contentHtml` should already be sanitized; this catches obvious injections from
 * markdown/HTML hybrids. Native shells should still enforce CSP and block remote scripts.
 */
export function stripDangerousMarkupForWebViewFragment(html: string): string {
  let out = replaceSpans(
    html,
    { open: SCRIPT_OPEN, close: /<\/script>/gi, skipTag: true },
    () => "",
  );
  out = stripSelfClosingScripts(out);
  out = out.replace(/\son[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return out;
}
