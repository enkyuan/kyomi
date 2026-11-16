import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import { faviconHosts } from "@kyomi/db";
import type * as schema from "@kyomi/db";
import { FAVICON_PROXY_VERSION } from "./proxy-url";
import { ALLOWED_SCHEMES } from "./host-safety";
import { resolveFeedFaviconUrl, type FaviconResolutionSource } from "./resolve";

const FAVICON_HOST_HIT_TTL_MS = 30 * 24 * 60 * 60_000;
const FAVICON_HOST_MISS_TTL_MS = 2 * 60_000;

export type FaviconDatabase = ReturnType<typeof drizzle<typeof schema>>;

export type ParsedFaviconOrigin = {
  origin: string;
  hostname: string;
};

export type CachedFaviconHost = {
  origin: string;
  hostname: string;
  resolvedUrl: string | null;
  source: string | null;
  status: string;
  contentType: string | null;
  width: number | null;
  height: number | null;
  expiresAt: Date | null;
  errorCode: string | null;
  version: string;
};

export type FaviconHostStore = {
  read(origin: string): Promise<CachedFaviconHost | null>;
  writeHit(input: {
    origin: string;
    hostname: string;
    resolvedUrl: string;
    source: FaviconResolutionSource;
    expiresAt: Date;
  }): Promise<void>;
  writeMiss(input: {
    origin: string;
    hostname: string;
    errorCode: string;
    expiresAt: Date;
  }): Promise<void>;
  updateResponseMetadata(input: {
    origin: string;
    contentType: string;
    width?: number | null;
    height?: number | null;
  }): Promise<void>;
};

export type PersistedFaviconHostResult =
  | {
      kind: "hit";
      origin: string;
      hostname: string;
      url: string;
      source: FaviconResolutionSource;
      contentType: string | null;
    }
  | {
      kind: "miss";
      origin: string;
      hostname: string;
      errorCode: string | null;
    };

const inFlightResolutions = new Map<string, Promise<PersistedFaviconHostResult>>();

export function faviconSourceRank(source: string | null): number {
  switch (source) {
    case "html_link":
    case "feed_icon":
      return 3;
    case "google_s2":
    case "duckduckgo":
      return 2;
    case "favicon_ico":
      return 1;
    default:
      return 0;
  }
}

export function parseFaviconOrigin(raw: string | null | undefined): ParsedFaviconOrigin | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = new URL(raw.trim());
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return null;
    }
    return {
      origin: parsed.origin,
      hostname: parsed.hostname,
    };
  } catch {
    return null;
  }
}

export function createDrizzleFaviconHostStore(database: FaviconDatabase): FaviconHostStore {
  return {
    async read(origin) {
      const [row] = await database
        .select({
          origin: faviconHosts.origin,
          hostname: faviconHosts.hostname,
          resolvedUrl: faviconHosts.resolvedUrl,
          source: faviconHosts.source,
          status: faviconHosts.status,
          contentType: faviconHosts.contentType,
          width: faviconHosts.width,
          height: faviconHosts.height,
          expiresAt: faviconHosts.expiresAt,
          errorCode: faviconHosts.errorCode,
          version: faviconHosts.version,
        })
        .from(faviconHosts)
        .where(eq(faviconHosts.origin, origin))
        .limit(1);
      return row ?? null;
    },
    async writeHit(input) {
      const now = new Date();
      await database
        .insert(faviconHosts)
        .values({
          origin: input.origin,
          hostname: input.hostname,
          resolvedUrl: input.resolvedUrl,
          source: input.source,
          status: "hit",
          expiresAt: input.expiresAt,
          lastCheckedAt: now,
          lastFailedAt: null,
          errorCode: null,
          version: FAVICON_PROXY_VERSION,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: faviconHosts.origin,
          set: {
            hostname: input.hostname,
            resolvedUrl: input.resolvedUrl,
            source: input.source,
            status: "hit",
            expiresAt: input.expiresAt,
            lastCheckedAt: now,
            lastFailedAt: null,
            errorCode: null,
            version: FAVICON_PROXY_VERSION,
            updatedAt: now,
          },
        });
    },
    async writeMiss(input) {
      const now = new Date();
      await database
        .insert(faviconHosts)
        .values({
          origin: input.origin,
          hostname: input.hostname,
          resolvedUrl: null,
          source: null,
          status: "miss",
          contentType: null,
          width: null,
          height: null,
          expiresAt: input.expiresAt,
          lastCheckedAt: now,
          lastFailedAt: now,
          errorCode: input.errorCode,
          version: FAVICON_PROXY_VERSION,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: faviconHosts.origin,
          set: {
            hostname: input.hostname,
            resolvedUrl: null,
            source: null,
            status: "miss",
            contentType: null,
            width: null,
            height: null,
            expiresAt: input.expiresAt,
            lastCheckedAt: now,
            lastFailedAt: now,
            errorCode: input.errorCode,
            version: FAVICON_PROXY_VERSION,
            updatedAt: now,
          },
        });
    },
    async updateResponseMetadata(input) {
      await database
        .update(faviconHosts)
        .set({
          contentType: input.contentType,
          width: input.width ?? null,
          height: input.height ?? null,
          updatedAt: new Date(),
        })
        .where(eq(faviconHosts.origin, input.origin));
    },
  };
}

function cachedResult(
  parsed: ParsedFaviconOrigin,
  cached: CachedFaviconHost,
): PersistedFaviconHostResult | null {
  if (cached.version !== FAVICON_PROXY_VERSION || !cached.expiresAt) {
    return null;
  }
  if (cached.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  if (cached.status === "hit" && cached.resolvedUrl && cached.source) {
    return {
      kind: "hit",
      origin: parsed.origin,
      hostname: parsed.hostname,
      url: cached.resolvedUrl,
      source: cached.source as FaviconResolutionSource,
      contentType: cached.contentType,
    };
  }
  if (cached.status === "miss") {
    return {
      kind: "miss",
      origin: parsed.origin,
      hostname: parsed.hostname,
      errorCode: cached.errorCode,
    };
  }
  return null;
}

async function resolveAndPersist(
  store: FaviconHostStore,
  parsed: ParsedFaviconOrigin,
): Promise<PersistedFaviconHostResult> {
  const resolved = await resolveFeedFaviconUrl(parsed.origin);
  if (resolved) {
    await store.writeHit({
      origin: parsed.origin,
      hostname: parsed.hostname,
      resolvedUrl: resolved.url,
      source: resolved.source,
      expiresAt: new Date(Date.now() + FAVICON_HOST_HIT_TTL_MS),
    });
    return {
      kind: "hit",
      origin: parsed.origin,
      hostname: parsed.hostname,
      url: resolved.url,
      source: resolved.source,
      contentType: null,
    };
  }

  await store.writeMiss({
    origin: parsed.origin,
    hostname: parsed.hostname,
    errorCode: "not_found",
    expiresAt: new Date(Date.now() + FAVICON_HOST_MISS_TTL_MS),
  });
  return {
    kind: "miss",
    origin: parsed.origin,
    hostname: parsed.hostname,
    errorCode: "not_found",
  };
}

export async function resolvePersistedFaviconHost(
  store: FaviconHostStore,
  rawUrl: string,
  options?: { forceRefresh?: boolean },
): Promise<PersistedFaviconHostResult | null> {
  const parsed = parseFaviconOrigin(rawUrl);
  if (!parsed) {
    return null;
  }

  if (!options?.forceRefresh) {
    const cached = await store.read(parsed.origin);
    const result = cached ? cachedResult(parsed, cached) : null;
    if (result) {
      return result;
    }
  }

  const existing = inFlightResolutions.get(parsed.origin);
  if (existing) {
    return existing;
  }

  const promise = resolveAndPersist(store, parsed);
  inFlightResolutions.set(parsed.origin, promise);
  try {
    return await promise;
  } finally {
    inFlightResolutions.delete(parsed.origin);
  }
}

export async function resolvePersistedFeedFaviconUrl(
  store: FaviconHostStore,
  seedUrl: string,
): Promise<{ url: string; source: FaviconResolutionSource } | null> {
  const result = await resolvePersistedFaviconHost(store, seedUrl);
  return result?.kind === "hit" ? { url: result.url, source: result.source } : null;
}
