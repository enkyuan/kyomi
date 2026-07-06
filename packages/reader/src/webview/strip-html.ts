/**
 * Lightweight hardening for WebView HTML strings (no full DOM parser).
 * API `contentHtml` should already be sanitized; this catches obvious injections from
 * markdown/HTML hybrids. Native shells should still enforce CSP and block remote scripts.
 */
export function stripDangerousMarkupForWebViewFragment(html: string): string {
  let out = html;
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script\b[^>]*\/>/gi, "");
  out = out.replace(/\son[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return out;
}
