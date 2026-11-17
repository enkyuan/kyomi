import { Effect, Layer } from "effect";
import { OpmlFeeds, type OpmlFeedsShape } from "@modules/opml/feeds";

export function buildOpml(feedCount: number, options?: { depth?: number }): string {
  const outlines = Array.from({ length: feedCount }, (_, index) => {
    const url = "https://example.com/Feed/" + index + "?Key=Value";
    return '<outline text="Feed ' + index + '" xmlUrl="' + url + '"/>';
  }).join("");
  const depth = options?.depth ?? 0;
  const open = Array.from(
    { length: depth },
    (_, index) => '<outline text="Folder ' + index + '">',
  ).join("");
  const close = "</outline>".repeat(depth);
  return (
    '<?xml version="1.0"?><opml version="2.0"><body>' + open + outlines + close + "</body></opml>"
  );
}

/** Run an Effect to its success value with `layer` providing every service it needs. */
export function runWith<A, E, R>(effect: Effect.Effect<A, E, R>, layer: Layer.Layer<R>) {
  return Effect.runPromise(Effect.provide(effect, layer));
}

/** Run an Effect that must fail and return its typed error. */
export function failureWith<A, E, R>(effect: Effect.Effect<A, E, R>, layer: Layer.Layer<R>) {
  return Effect.runPromise(Effect.provide(Effect.flip(effect), layer));
}

const subscription = {
  feedId: "feed-1",
  subscriptionId: "sub-1",
  url: "https://example.com/feed.xml",
  title: "Feed",
  link: null,
  faviconUrl: null,
  faviconSource: null,
  newFeed: true,
  newSubscription: true,
};

/** `OpmlFeeds` that records its calls; override a method to change what it answers. */
export function feedsLayer(overrides: Partial<OpmlFeedsShape> = {}) {
  const calls = {
    subscribeToFeedUrl: [] as unknown[][],
    subscribeToKnownFeed: [] as unknown[][],
    requestInitialRefresh: [] as unknown[][],
    ensureFolders: [] as unknown[][],
    getOrCreateFolder: [] as unknown[][],
  };
  const shape: OpmlFeedsShape = {
    subscribeToFeedUrl: (...args) => {
      calls.subscribeToFeedUrl.push(args);
      return Effect.succeed(subscription);
    },
    subscribeToKnownFeed: (...args) => {
      calls.subscribeToKnownFeed.push(args);
      return Effect.succeed({ ...subscription, newFeed: false });
    },
    requestInitialRefresh: (...args) => {
      calls.requestInitialRefresh.push(args);
      return Effect.void;
    },
    ensureFolders: (...args) => {
      calls.ensureFolders.push(args);
      return Effect.succeed(new Map());
    },
    getOrCreateFolder: (...args) => {
      calls.getOrCreateFolder.push(args);
      return Effect.succeed({ id: "folder-1" });
    },
    ...overrides,
  };
  return { calls, layer: Layer.succeed(OpmlFeeds, OpmlFeeds.of(shape)) };
}
