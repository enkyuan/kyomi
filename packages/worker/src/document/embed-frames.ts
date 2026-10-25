import type { ReaderEmbedProvider } from "@kyomi/reader/document";

export type EmbedFrame = {
  providerId: string;
  /** Iframe URL built from the provider's allowlisted template, never from source markup. */
  frameUrl?: string;
  /** width / height of the player box. */
  aspectRatio?: number;
};

const VIDEO_RATIO = 16 / 9;

function pathParts(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

type Template = (url: URL) => EmbedFrame | null;

/**
 * One template per provider that can be framed. Providers absent here (X, Bluesky, Mastodon,
 * Threads, Instagram, TikTok, Gist) run scripts or need an async snapshot, so they carry no
 * `frameUrl`; renderers show their snapshot or a link card instead.
 */
const FRAME_TEMPLATES: Partial<Record<ReaderEmbedProvider, Template>> = {
  youtube: (url) => {
    const id = url.searchParams.get("v");
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id)
      ? {
          providerId: id,
          frameUrl: `https://www.youtube-nocookie.com/embed/${id}`,
          aspectRatio: VIDEO_RATIO,
        }
      : null;
  },
  vimeo: (url) => {
    const id = pathParts(url)[0];
    return id && /^\d+$/.test(id)
      ? {
          providerId: id,
          frameUrl: `https://player.vimeo.com/video/${id}?dnt=1`,
          aspectRatio: VIDEO_RATIO,
        }
      : null;
  },
  spotify: (url) => {
    const [type, id] = pathParts(url);
    return type && id
      ? { providerId: `${type}/${id}`, frameUrl: `https://open.spotify.com/embed/${type}/${id}` }
      : null;
  },
  soundcloud: (url) => ({
    providerId: url.pathname.replace(/^\//, ""),
    frameUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}`,
  }),
  "apple-podcasts": (url) => ({
    providerId: url.pathname.replace(/^\//, ""),
    frameUrl: `https://embed.podcasts.apple.com${url.pathname}${url.search}`,
  }),
  codepen: (url) => {
    const [user, , id] = pathParts(url);
    return user && id
      ? {
          providerId: `${user}/${id}`,
          frameUrl: `https://codepen.io/${user}/embed/${id}?default-tab=result`,
          aspectRatio: VIDEO_RATIO,
        }
      : null;
  },
  codesandbox: (url) => {
    const id = pathParts(url)[1];
    return id
      ? { providerId: id, frameUrl: `https://codesandbox.io/embed/${id}`, aspectRatio: VIDEO_RATIO }
      : null;
  },
  loom: (url) => {
    const id = pathParts(url)[1];
    return id
      ? { providerId: id, frameUrl: `https://www.loom.com/embed/${id}`, aspectRatio: VIDEO_RATIO }
      : null;
  },
  figma: (url) => ({
    providerId: url.pathname.replace(/^\//, ""),
    frameUrl: `https://www.figma.com/embed?embed_host=kyomi&url=${encodeURIComponent(url.href)}`,
    aspectRatio: VIDEO_RATIO,
  }),
};

/** The frame data for a canonical public URL, or null when the URL does not fit the template. */
export function embedFrame(provider: ReaderEmbedProvider, publicUrl: string): EmbedFrame | null {
  const template = FRAME_TEMPLATES[provider];
  if (!template) {
    return null;
  }
  try {
    return template(new URL(publicUrl));
  } catch {
    return null;
  }
}

export function providerIsFramed(provider: ReaderEmbedProvider): boolean {
  return provider in FRAME_TEMPLATES;
}

/** True when `frameUrl` is exactly what the provider template builds for `publicUrl`. */
export function isAllowedFrameUrl(
  provider: ReaderEmbedProvider,
  publicUrl: string,
  frameUrl: string,
): boolean {
  return embedFrame(provider, publicUrl)?.frameUrl === frameUrl;
}
