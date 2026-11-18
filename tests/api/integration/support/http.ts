import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";

type Answer = Response | Error | Promise<Response>;

export type ScriptedRequest = {
  method: string;
  url: string;
  headers: Readonly<Record<string, string>>;
  /** The request body as text, when it has one. */
  body: string | undefined;
};

/** An `Error` shaped like the runtime's TLS verification failure (`code` is what the API reads). */
export function tlsError(code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
  return Object.assign(new Error("unable to verify the first certificate"), { code });
}

/**
 * An `HttpClient` that answers each request from `respond`: a `Response` is returned as is, an
 * `Error` becomes a transport failure (what `fetch` throws), and a never-settling promise models a
 * server that does not answer. No network.
 */
export const scriptedHttpClient = (respond: (request: ScriptedRequest) => Answer) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      const answer = respond({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body._tag === "Uint8Array" ? request.body.text : undefined,
      });
      if (answer instanceof Error) {
        return Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request, cause: answer }),
          }),
        );
      }
      return Effect.promise(async () => HttpClientResponse.fromWeb(request, await answer));
    }),
  );
