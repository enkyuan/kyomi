import type { ReaderInline } from "../../core/document";

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
};
const SUBSCRIPT: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
};

/**
 * React Native has no baseline shift, so sub/superscripts map to Unicode glyphs when every
 * character has one. Returns `null` when the text needs the smaller-font fallback.
 */
export function shiftScript(text: string, kind: "sub" | "super"): string | null {
  const table = kind === "sub" ? SUBSCRIPT : SUPERSCRIPT;
  let out = "";
  for (const char of text) {
    const mapped = table[char];
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out;
}

/** Plain text of inline nodes, used for accessibility labels and share/copy fallbacks. */
export function inlinesToText(inlines: readonly ReaderInline[] | undefined): string {
  if (!inlines) return "";
  let out = "";
  for (const inline of inlines) {
    switch (inline.type) {
      case "text":
      case "code":
        out += inline.value;
        break;
      case "format":
      case "link":
      case "abbr":
        out += inlinesToText(inline.children);
        break;
      case "break":
        out += "\n";
        break;
      case "math":
        out += inline.tex ?? "";
        break;
      case "footnoteRef":
        out += `[${inline.label}]`;
        break;
      case "image":
        out += inline.image.alt;
        break;
    }
  }
  return out;
}

/** http(s) and mailto are the only schemes the reader hands to the system. */
export function safeExternalUrl(href: string): string | null {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const PROVIDER_NAMES: Record<string, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  x: "X",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  threads: "Threads",
  instagram: "Instagram",
  tiktok: "TikTok",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  "apple-podcasts": "Apple Podcasts",
  "github-gist": "GitHub Gist",
  codepen: "CodePen",
  codesandbox: "CodeSandbox",
  loom: "Loom",
  figma: "Figma",
};

export function providerName(provider: string): string {
  return PROVIDER_NAMES[provider] ?? provider;
}
