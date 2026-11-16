import type { ARTICLE_EMBED_PROVIDERS } from "@kyomi/reader/sanitization";

export type EmbedProvider = (typeof ARTICLE_EMBED_PROVIDERS)[number];

/** A recognized embed: its provider and the item's canonical public URL. */
export type RecognizedEmbed = { provider: EmbedProvider; url: string };

type Rule = {
  provider: EmbedProvider;
  hosts: readonly string[];
  /** Maps a parsed URL to the canonical public URL, or null when the path does not match. */
  canonical: (url: URL) => string | null;
};

const ID = "([A-Za-z0-9_-]+)";

function match(url: URL, pattern: string): RegExpMatchArray | null {
  return url.pathname.match(new RegExp(`^${pattern}/?$`));
}

function nestedUrlParam(url: URL, name: string, host: RegExp): string | null {
  const value = url.searchParams.get(name);
  if (!value) {
    return null;
  }
  try {
    const nested = new URL(value);
    return nested.protocol === "https:" && host.test(nested.hostname) ? nested.href : null;
  } catch {
    return null;
  }
}

/**
 * Embed and public URL shapes per provider. Embed (iframe) forms map to the public page so the
 * stored URL is a link a reader can open, never the provider's player URL.
 */
const RULES: readonly Rule[] = [
  {
    provider: "youtube",
    hosts: ["youtube.com", "youtube-nocookie.com", "youtu.be"],
    canonical: (url) => {
      const id =
        (url.hostname.endsWith("youtu.be") ? match(url, `/${ID}`)?.[1] : null) ??
        match(url, `/(?:embed|shorts|live|v)/${ID}`)?.[1] ??
        (url.pathname === "/watch" ? url.searchParams.get("v") : null);
      return id && /^[A-Za-z0-9_-]{6,20}$/.test(id)
        ? `https://www.youtube.com/watch?v=${id}`
        : null;
    },
  },
  {
    provider: "vimeo",
    hosts: ["vimeo.com"],
    canonical: (url) => {
      const id = match(url, "/(?:video/)?(\\d+)")?.[1];
      return id ? `https://vimeo.com/${id}` : null;
    },
  },
  {
    provider: "x",
    hosts: ["twitter.com", "x.com"],
    canonical: (url) => {
      const status = match(url, `/${ID}/status(?:es)?/(\\d+)(?:/.*)?`);
      if (status) {
        return `https://x.com/${status[1]}/status/${status[2]}`;
      }
      const id = url.pathname.startsWith("/embed/Tweet.html") ? url.searchParams.get("id") : null;
      return id && /^\d+$/.test(id) ? `https://x.com/i/status/${id}` : null;
    },
  },
  {
    provider: "bluesky",
    hosts: ["bsky.app", "embed.bsky.app"],
    canonical: (url) => {
      const post =
        match(url, "/profile/([^/]+)/post/([A-Za-z0-9]+)") ??
        match(url, "/embed/([^/]+)/app\\.bsky\\.feed\\.post/([A-Za-z0-9]+)");
      return post ? `https://bsky.app/profile/${post[1]}/post/${post[2]}` : null;
    },
  },
  {
    provider: "instagram",
    hosts: ["instagram.com"],
    canonical: (url) => {
      const post = match(url, `/(p|reel|tv)/${ID}(?:/embed(?:/captioned)?)?`);
      return post ? `https://www.instagram.com/${post[1]}/${post[2]}/` : null;
    },
  },
  {
    provider: "tiktok",
    hosts: ["tiktok.com"],
    canonical: (url) => {
      const video = match(url, "/(@[A-Za-z0-9_.-]+)/video/(\\d+)");
      return video ? `https://www.tiktok.com/${video[1]}/video/${video[2]}` : null;
    },
  },
  {
    provider: "threads",
    hosts: ["threads.net", "threads.com"],
    canonical: (url) => {
      const post = match(url, `/(@[A-Za-z0-9_.]+)/post/${ID}(?:/embed)?`);
      return post ? `https://www.threads.net/${post[1]}/post/${post[2]}` : null;
    },
  },
  {
    provider: "spotify",
    hosts: ["open.spotify.com"],
    canonical: (url) => {
      const item = match(url, `(?:/embed)?/(track|album|playlist|episode|show|artist)/${ID}`);
      return item ? `https://open.spotify.com/${item[1]}/${item[2]}` : null;
    },
  },
  {
    provider: "soundcloud",
    hosts: ["soundcloud.com"],
    canonical: (url) =>
      url.hostname.startsWith("w.")
        ? nestedUrlParam(url, "url", /(^|\.)soundcloud\.com$/)
        : match(url, "/[^/]+/[^/]+")
          ? `https://soundcloud.com${url.pathname.replace(/\/$/, "")}`
          : null,
  },
  {
    provider: "apple-podcasts",
    hosts: ["podcasts.apple.com", "embed.podcasts.apple.com"],
    canonical: (url) =>
      match(url, "/[a-z]{2}/podcast/.+")
        ? `https://podcasts.apple.com${url.pathname}${url.searchParams.has("i") ? `?i=${url.searchParams.get("i")}` : ""}`
        : null,
  },
  {
    provider: "github-gist",
    hosts: ["gist.github.com"],
    canonical: (url) => {
      const gist = match(url, `/${ID}/([0-9a-f]+)(?:\\.js)?`);
      return gist ? `https://gist.github.com/${gist[1]}/${gist[2]}` : null;
    },
  },
  {
    provider: "codepen",
    hosts: ["codepen.io"],
    canonical: (url) => {
      const pen = match(url, `/${ID}/(?:pen|embed(?:/preview)?|full|details)/${ID}`);
      return pen ? `https://codepen.io/${pen[1]}/pen/${pen[2]}` : null;
    },
  },
  {
    provider: "codesandbox",
    hosts: ["codesandbox.io"],
    canonical: (url) => {
      const sandbox = match(url, `/(?:s|embed|p/sandbox)/${ID}`);
      return sandbox ? `https://codesandbox.io/s/${sandbox[1]}` : null;
    },
  },
  {
    provider: "loom",
    hosts: ["loom.com"],
    canonical: (url) => {
      const video = match(url, "/(?:share|embed)/([0-9a-f]{32})");
      return video ? `https://www.loom.com/share/${video[1]}` : null;
    },
  },
  {
    provider: "figma",
    hosts: ["figma.com"],
    canonical: (url) =>
      url.pathname === "/embed"
        ? nestedUrlParam(url, "url", /(^|\.)figma\.com$/)
        : match(url, `/(?:file|design|proto|board)/${ID}(?:/.*)?`)
          ? `https://www.figma.com${url.pathname}`
          : null,
  },
];

function hostMatches(hostname: string, hosts: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

/** Recognizes a provider URL (embed or public form) and returns its canonical public URL. */
export function recognizeEmbedUrl(value: string): RecognizedEmbed | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  for (const rule of RULES) {
    if (hostMatches(url.hostname, rule.hosts)) {
      const canonical = rule.canonical(url);
      return canonical ? { provider: rule.provider, url: canonical } : null;
    }
  }
  return null;
}

/** Mastodon is self-hosted, so it is recognized by path shape instead of host. */
export function recognizeMastodonUrl(value: string): RecognizedEmbed | null {
  try {
    const url = new URL(value);
    const status = url.pathname.match(
      /^\/(@[A-Za-z0-9_]+(?:@[A-Za-z0-9.-]+)?)\/(\d+)(?:\/embed)?\/?$/,
    );
    return url.protocol === "https:" && status
      ? { provider: "mastodon", url: `https://${url.host}/${status[1]}/${status[2]}` }
      : null;
  } catch {
    return null;
  }
}
