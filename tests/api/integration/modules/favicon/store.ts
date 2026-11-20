import {
  FAVICON_PROXY_VERSION,
  type FaviconHostStore,
  type FaviconResolutionSource,
} from "@kyomi/ingest/favicon";

export const ORIGIN = "https://93.184.216.34";

export type CachedFaviconHost = NonNullable<Awaited<ReturnType<FaviconHostStore["read"]>>>;

export class MemoryFaviconHostStore implements FaviconHostStore {
  rows = new Map<string, CachedFaviconHost>();

  seed(row: CachedFaviconHost) {
    this.rows.set(row.origin, row);
  }

  seedHit(input: {
    origin?: string;
    resolvedUrl: string;
    source?: FaviconResolutionSource;
    expiresAt?: Date;
  }) {
    const origin = input.origin ?? ORIGIN;
    this.seed({
      origin,
      hostname: new URL(origin).hostname,
      resolvedUrl: input.resolvedUrl,
      source: input.source ?? "html_link",
      status: "hit",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000),
      errorCode: null,
      version: FAVICON_PROXY_VERSION,
    });
  }

  seedMiss(input: { origin?: string; expiresAt?: Date; errorCode?: string }) {
    const origin = input.origin ?? ORIGIN;
    this.seed({
      origin,
      hostname: new URL(origin).hostname,
      resolvedUrl: null,
      source: null,
      status: "miss",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000),
      errorCode: input.errorCode ?? "not_found",
      version: FAVICON_PROXY_VERSION,
    });
  }

  async read(origin: string) {
    return this.rows.get(origin) ?? null;
  }

  async writeHit(input: {
    origin: string;
    hostname: string;
    resolvedUrl: string;
    source: FaviconResolutionSource;
    expiresAt: Date;
  }) {
    this.seed({
      origin: input.origin,
      hostname: input.hostname,
      resolvedUrl: input.resolvedUrl,
      source: input.source,
      status: "hit",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt,
      errorCode: null,
      version: FAVICON_PROXY_VERSION,
    });
  }

  async writeMiss(input: { origin: string; hostname: string; errorCode: string; expiresAt: Date }) {
    this.seed({
      origin: input.origin,
      hostname: input.hostname,
      resolvedUrl: null,
      source: null,
      status: "miss",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt,
      errorCode: input.errorCode,
      version: FAVICON_PROXY_VERSION,
    });
  }

  async updateResponseMetadata(input: {
    origin: string;
    contentType: string;
    width?: number | null;
    height?: number | null;
  }) {
    const row = this.rows.get(input.origin);
    if (!row) {
      return;
    }
    this.rows.set(input.origin, {
      ...row,
      contentType: input.contentType,
      width: input.width ?? null,
      height: input.height ?? null,
    });
  }
}
