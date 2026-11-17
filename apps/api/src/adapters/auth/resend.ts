import { Duration, Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { AppLogger } from "@adapters/logger/service";
import type { LogContext } from "@adapters/logger/pino";
import { AppConfig } from "@config/env/service";
import { UpstreamError } from "@shared/effect/errors";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DELIVERY_TIMEOUT = Duration.seconds(10);

export type EmailContent = { subject: string; text: string; html: string };

export type EmailDelivery = "delivered" | "development-link" | "unconfigured";

type DeliveryOptions = {
  to: string;
  content: EmailContent;
  /** What the message is (`"Email OTP"`), for the failure message. */
  label: string;
  /** Log events for a sender that is not configured: development logs the secret, production errors. */
  events: { development: string; unconfigured: string };
  /** What to log in place of sending when no provider is configured outside production. */
  developmentLog: LogContext;
};

/**
 * Send one email through the Resend HTTP API. Without an API key and sender it does not send: in
 * development the message's secret is logged instead, in production the gap is logged as an error.
 * A rejected or timed-out request fails with `UpstreamError`.
 */
export const deliverEmail = Effect.fn("auth.email.deliver")(function* (options: DeliveryOptions) {
  const config = yield* AppConfig;
  const log = yield* AppLogger;
  const apiKey = config.RESEND_API_KEY;
  const from = config.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    if (config.NODE_ENV !== "production") {
      yield* log.warn(options.events.development, options.developmentLog);
      return "development-link" as const satisfies EmailDelivery;
    }
    yield* log.error(options.events.unconfigured);
    return "unconfigured" as const satisfies EmailDelivery;
  }

  const client = HttpClient.withScope(yield* HttpClient.HttpClient);
  const request = HttpClientRequest.post(RESEND_EMAILS_URL).pipe(
    HttpClientRequest.bearerToken(apiKey),
    HttpClientRequest.bodyJsonUnsafe({ from, to: [options.to], ...options.content }),
  );
  yield* client.execute(request).pipe(
    Effect.timeout(DELIVERY_TIMEOUT),
    Effect.flatMap((response) =>
      response.status >= 200 && response.status < 300
        ? Effect.void
        : Effect.fail(new Error(`${options.label} delivery failed with status ${response.status}`)),
    ),
    Effect.scoped,
    Effect.mapError((cause) => new UpstreamError({ operation: "resend email delivery", cause })),
  );
  return "delivered" as const satisfies EmailDelivery;
});
