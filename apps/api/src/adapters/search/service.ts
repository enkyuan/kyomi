import { Context, Duration, Effect, Layer, Ref, Semaphore } from "effect";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import { AppConfig } from "@config/env/service";
import { Unavailable, UpstreamError } from "@shared/effect/errors";
import { normalizeLoopbackUrl } from "@shared/net/loopback";

export type FeedSearchDocument = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  faviconUrl?: string | null;
  sourceKind?: string | null;
  language?: string | null;
  categories?: string[];
  contentType?: string | null;
  qualityScore?: number | null;
  domain?: string | null;
};

/** `Unavailable` carries the Meilisearch code (`MEILI_*`); `UpstreamError` is a transport failure. */
export type FeedSearchError = Unavailable | UpstreamError;

const REQUEST_TIMEOUT = Duration.seconds(10);
const SEARCHABLE_ATTRIBUTES = ["title", "url", "description", "link", "domain"];
const FILTERABLE_ATTRIBUTES = ["sourceKind", "language", "categories", "contentType", "domain"];

export type FeedSearchShape = {
  /** True when `MEILI_URL` is set. Operations are no-ops (or empty) when it is not. */
  readonly isConfigured: () => boolean;
  /** Add or replace feed documents, creating the index and its settings on first use. */
  readonly upsert: (
    documents: readonly FeedSearchDocument[],
  ) => Effect.Effect<void, FeedSearchError>;
  /** Remove a feed document; a document that is already gone is not an error. */
  readonly remove: (feedId: string) => Effect.Effect<void, FeedSearchError>;
  readonly search: (
    query: string,
    limit: number,
  ) => Effect.Effect<FeedSearchDocument[], FeedSearchError>;
};

/**
 * Meilisearch feed index over the `HttpClient` service. Settings are read from `AppConfig` on each
 * call; the index is created once per layer (concurrent first calls wait for the same creation, a
 * failed one is retried by the next call). Every request has a finite timeout.
 */
export class FeedSearch extends Context.Service<FeedSearch, FeedSearchShape>()("kyomi/FeedSearch") {
  static readonly layer = Layer.effect(
    FeedSearch,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const client = HttpClient.withScope(yield* HttpClient.HttpClient);
      const indexReady = yield* Ref.make(false);
      const indexLock = yield* Semaphore.make(1);

      const settings = () => {
        const raw = config.MEILI_URL?.trim();
        return {
          baseUrl: raw ? normalizeLoopbackUrl(raw).replace(/\/+$/, "") : null,
          indexUid: config.MEILI_INDEX_FEEDS?.trim() || "feeds",
          masterKey: config.MEILI_MASTER_KEY,
        };
      };

      /** One request. The response is released when the caller's scope closes. */
      const send = (method: "POST" | "PUT" | "DELETE", path: string, body?: unknown) =>
        Effect.gen(function* () {
          const { baseUrl, masterKey } = settings();
          if (!baseUrl) {
            return yield* new Unavailable({
              message: "Meilisearch is not configured",
              code: "MEILI_NOT_CONFIGURED",
            });
          }
          const request = HttpClientRequest.make(method)(`${baseUrl}${path}`, {
            headers: masterKey ? { authorization: `Bearer ${masterKey}` } : {},
          });
          return yield* client
            .execute(body === undefined ? request : HttpClientRequest.bodyJsonUnsafe(request, body))
            .pipe(
              Effect.timeout(REQUEST_TIMEOUT),
              Effect.catchTag("TimeoutError", () =>
                Effect.fail(
                  new Unavailable({
                    message: "Meilisearch request timed out",
                    code: "MEILI_TIMEOUT",
                  }),
                ),
              ),
              Effect.catchTag("HttpClientError", (cause) =>
                Effect.fail(new UpstreamError({ operation: `meili ${method} ${path}`, cause })),
              ),
            );
        });

      /** `send`, failing with the Meilisearch `code` unless the status is 2xx (or in `accept`). */
      const call = (
        what: string,
        code: string,
        method: "POST" | "PUT" | "DELETE",
        path: string,
        options: { body?: unknown; accept?: readonly number[] } = {},
      ) =>
        send(method, path, options.body).pipe(
          Effect.filterOrFail(
            (response) =>
              (response.status >= 200 && response.status < 300) ||
              options.accept?.includes(response.status) === true,
            (response) =>
              new Unavailable({ message: `Meilisearch ${what} (${response.status})`, code }),
          ),
        );

      const configureIndex = Effect.gen(function* () {
        const { indexUid } = settings();
        yield* call("index init failed", "MEILI_INDEX_INIT_FAILED", "POST", "/indexes", {
          body: { uid: indexUid, primaryKey: "id" },
          accept: [409],
        });
        yield* call(
          "searchable-attributes update failed",
          "MEILI_SETTINGS_UPDATE_FAILED",
          "PUT",
          `/indexes/${indexUid}/settings/searchable-attributes`,
          { body: SEARCHABLE_ATTRIBUTES },
        );
        yield* call(
          "filterable-attributes update failed",
          "MEILI_SETTINGS_UPDATE_FAILED",
          "PUT",
          `/indexes/${indexUid}/settings/filterable-attributes`,
          { body: FILTERABLE_ATTRIBUTES },
        );
      }).pipe(Effect.scoped);

      const ensureIndex = indexLock.withPermits(1)(
        Effect.gen(function* () {
          if (!(yield* Ref.get(indexReady))) {
            yield* configureIndex;
            yield* Ref.set(indexReady, true);
          }
        }),
      );

      return FeedSearch.of({
        isConfigured: () => settings().baseUrl !== null,

        upsert: Effect.fn("search.upsert")(function* (documents: readonly FeedSearchDocument[]) {
          if (documents.length === 0 || settings().baseUrl === null) {
            return;
          }
          yield* ensureIndex;
          yield* call(
            "upsert failed",
            "MEILI_UPSERT_FAILED",
            "POST",
            `/indexes/${settings().indexUid}/documents`,
            { body: documents },
          ).pipe(Effect.scoped);
        }),

        remove: Effect.fn("search.remove")(function* (feedId: string) {
          if (settings().baseUrl === null) {
            return;
          }
          yield* call(
            "delete failed",
            "MEILI_DELETE_FAILED",
            "DELETE",
            `/indexes/${settings().indexUid}/documents/${encodeURIComponent(feedId)}`,
            { accept: [404] },
          ).pipe(Effect.scoped);
        }),

        search: Effect.fn("search.query")(function* (query: string, limit: number) {
          if (settings().baseUrl === null) {
            return [];
          }
          yield* ensureIndex;
          return yield* Effect.gen(function* () {
            const response: HttpClientResponse.HttpClientResponse = yield* call(
              "search failed",
              "MEILI_SEARCH_FAILED",
              "POST",
              `/indexes/${settings().indexUid}/search`,
              { body: { q: query, limit } },
            );
            const payload = yield* response.json.pipe(
              Effect.mapError(
                (cause) => new UpstreamError({ operation: "meili search response", cause }),
              ),
            );
            const hits = (payload as { hits?: unknown } | null)?.hits;
            return Array.isArray(hits) ? (hits as FeedSearchDocument[]) : [];
          }).pipe(Effect.scoped);
        }),
      });
    }),
  );
}
