import { selectClientFaviconOrigin } from "@kyomi/worker/favicon/browser";

const FAVICON_CACHE_DB_NAME = "kyomi.favicon-cache";
const FAVICON_CACHE_STORE_NAME = "hosts";
const FAVICON_CACHE_DB_VERSION = 1;
const FAVICON_HIT_TTL_MS = 30 * 24 * 60 * 60_000;
const FAVICON_MISS_TTL_MS = 5 * 60_000;
const FAVICON_MEMORY_LIMIT = 256;
const FAVICON_PREWARM_LIMIT = 24;

export type CachedFaviconMetadata = {
  origin: string;
  url: string | null;
  status: "hit" | "miss";
  width: number | null;
  height: number | null;
  expiresAt: number;
  updatedAt: number;
};

const memoryCache = new Map<string, CachedFaviconMetadata>();
const prewarmedImages = new Map<string, HTMLImageElement>();

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export function canUsePersistentFaviconCache() {
  return canUseIndexedDb();
}

function getFresh(entry: CachedFaviconMetadata | null | undefined): CachedFaviconMetadata | null {
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry;
}

function remember(entry: CachedFaviconMetadata) {
  memoryCache.delete(entry.origin);
  memoryCache.set(entry.origin, entry);
  while (memoryCache.size > FAVICON_MEMORY_LIMIT) {
    const [oldest] = memoryCache.keys();
    if (!oldest) break;
    memoryCache.delete(oldest);
  }
}

function openFaviconCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(FAVICON_CACHE_DB_NAME, FAVICON_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(FAVICON_CACHE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB favicon cache upgrade was blocked."));
  });
}

async function readCachedFaviconFromDb(origin: string): Promise<CachedFaviconMetadata | null> {
  if (!canUseIndexedDb()) {
    return null;
  }

  const db = await openFaviconCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FAVICON_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(FAVICON_CACHE_STORE_NAME).get(origin);

    request.onsuccess = () =>
      resolve(getFresh(request.result as CachedFaviconMetadata | undefined));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function writeCachedFaviconToDb(entry: CachedFaviconMetadata): Promise<void> {
  if (!canUseIndexedDb()) {
    return;
  }

  const db = await openFaviconCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FAVICON_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(FAVICON_CACHE_STORE_NAME).put(entry, entry.origin);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export function getFaviconCacheOrigin(siteUrl: string | null, feedUrl: string): string | null {
  return selectClientFaviconOrigin(siteUrl, feedUrl);
}

export function peekCachedFaviconMetadata(origin: string | null): CachedFaviconMetadata | null {
  if (!origin) {
    return null;
  }
  const entry = getFresh(memoryCache.get(origin));
  if (!entry) {
    memoryCache.delete(origin);
  }
  return entry;
}

export async function readCachedFaviconMetadata(
  origin: string | null,
): Promise<CachedFaviconMetadata | null> {
  if (!origin) {
    return null;
  }
  const memoryEntry = peekCachedFaviconMetadata(origin);
  if (memoryEntry) {
    return memoryEntry;
  }
  const entry = await readCachedFaviconFromDb(origin);
  if (entry) {
    remember(entry);
  }
  return entry;
}

export function writeCachedFaviconHit(input: {
  origin: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
}) {
  if (!input.origin) {
    return;
  }
  const entry: CachedFaviconMetadata = {
    origin: input.origin,
    url: input.url,
    status: "hit",
    width: input.width ?? null,
    height: input.height ?? null,
    expiresAt: Date.now() + FAVICON_HIT_TTL_MS,
    updatedAt: Date.now(),
  };
  remember(entry);
  void writeCachedFaviconToDb(entry).catch(() => {});
}

export function writeCachedFaviconMiss(origin: string | null) {
  if (!origin) {
    return;
  }
  const entry: CachedFaviconMetadata = {
    origin,
    url: null,
    status: "miss",
    width: null,
    height: null,
    expiresAt: Date.now() + FAVICON_MISS_TTL_MS,
    updatedAt: Date.now(),
  };
  remember(entry);
  void writeCachedFaviconToDb(entry).catch(() => {});
}

export function prewarmFaviconUrl(url: string | null, priority: "high" | "normal" | "low") {
  if (priority !== "high" || !url || typeof Image === "undefined") {
    return;
  }
  if (prewarmedImages.has(url) || prewarmedImages.size >= FAVICON_PREWARM_LIMIT) {
    return;
  }
  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image.setAttribute("fetchpriority", "high");
  image.src = url;
  prewarmedImages.set(url, image);
}

export function clearFaviconMetadataMemoryCache() {
  memoryCache.clear();
  prewarmedImages.clear();
}
