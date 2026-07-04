declare const __SW_VERSION__: string;
declare const __STATIC_ASSET_URLS__: string[];

type ExtendableEvent = Event & {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerFetchEvent = Event & {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
};

type ServiceWorkerGlobal = {
  clients: {
    claim(): Promise<void>;
  };
  location: Location;
  skipWaiting(): Promise<void>;
  addEventListener(type: "install" | "activate", listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: WorkerFetchEvent) => void): void;
};

const serviceWorker = self as unknown as ServiceWorkerGlobal;
const CACHE_PREFIX = "kyomi-static";
const CACHE_NAME = `${CACHE_PREFIX}-${__SW_VERSION__}`;
const PRECACHE_URLS = __STATIC_ASSET_URLS__;

serviceWorker.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => serviceWorker.skipWaiting()),
  );
});

serviceWorker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const staleCacheDeletes: Promise<boolean>[] = [];
        for (const key of keys) {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            staleCacheDeletes.push(caches.delete(key));
          }
        }
        return Promise.all(staleCacheDeletes);
      })
      .then(() => serviceWorker.clients.claim()),
  );
});

serviceWorker.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== serviceWorker.location.origin || !PRECACHE_URLS.includes(url.pathname)) {
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
