import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { createEmailOTPBody, queueEmailOTP, sendEmailOTP } from "@adapters/auth/otp";
import { scriptedHttpClient, type ScriptedRequest } from "@api-tests/support/http";
import { recordingLogger, testConfig } from "@api-tests/support/layers";

const PRODUCTION_SENDER = {
  NODE_ENV: "production",
  RESEND_API_KEY: "re_test",
  AUTH_EMAIL_FROM: "Kyomi <auth@example.com>",
};

/** Services for a delivery: config, a recording logger and a scripted Resend. */
function delivery(
  config: Record<string, string>,
  respond: (request: ScriptedRequest) => Response | Error,
) {
  const requests: ScriptedRequest[] = [];
  const logs = recordingLogger();
  const layer = Layer.mergeAll(
    testConfig(config),
    logs.layer,
    scriptedHttpClient((request) => {
      requests.push(request);
      return respond(request);
    }),
  );
  return { requests, logs, layer };
}

const message = { to: "reader@example.com", otp: "654321" };

describe("email OTP delivery", () => {
  test("formats the sign-in code in text and HTML body", () => {
    const body = createEmailOTPBody({ to: "reader@example.com", otp: "123456" });

    expect(body.subject).toBe("Your Kyomi sign-in code");
    expect(body.text).toContain("123456");
    expect(body.html).toContain("123456");
  });

  test("sends the OTP code through the Resend HTTP API", async () => {
    const { requests, layer } = delivery(PRODUCTION_SENDER, () =>
      Response.json({ id: "email-id" }),
    );

    const outcome = await Effect.runPromise(sendEmailOTP(message).pipe(Effect.provide(layer)));

    expect(outcome).toBe("delivered");
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe("https://api.resend.com/emails");
    expect(request?.method).toBe("POST");
    expect(request?.headers.authorization).toBe("Bearer re_test");
    expect(JSON.parse(request?.body ?? "")).toMatchObject({
      from: "Kyomi <auth@example.com>",
      to: ["reader@example.com"],
      subject: "Your Kyomi sign-in code",
    });
  });

  test("logs the OTP when unconfigured outside production, without a request", async () => {
    const { requests, logs, layer } = delivery(
      { NODE_ENV: "development" },
      () => new Error("unexpected"),
    );

    const outcome = await Effect.runPromise(sendEmailOTP(message).pipe(Effect.provide(layer)));

    expect(outcome).toBe("development-link");
    expect(requests).toEqual([]);
    expect(logs.entries).toContainEqual({
      level: "warn",
      event: "auth.email_otp.development_log",
      context: { otp: "654321" },
    });
  });

  test("reports an unconfigured production sender without making a request", async () => {
    const { requests, logs, layer } = delivery(
      { NODE_ENV: "production" },
      () => new Error("unexpected"),
    );

    const outcome = await Effect.runPromise(sendEmailOTP(message).pipe(Effect.provide(layer)));

    expect(outcome).toBe("unconfigured");
    expect(requests).toEqual([]);
    expect(logs.entries.map((entry) => entry.event)).toEqual([
      "auth.email_otp.delivery_unconfigured",
    ]);
  });

  test("fails with an UpstreamError carrying the status when the provider rejects", async () => {
    const { layer } = delivery(PRODUCTION_SENDER, () => new Response(null, { status: 429 }));

    const error = await Effect.runPromise(
      Effect.flip(sendEmailOTP(message)).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "UpstreamError", operation: "resend email delivery" });
    expect(String((error.cause as Error).message)).toContain("status 429");
  });

  test("a background delivery logs a failure instead of escaping", async () => {
    const { logs, layer } = delivery(PRODUCTION_SENDER, () => new Error("connection refused"));

    await Effect.runPromise(queueEmailOTP(message).pipe(Effect.provide(layer)));

    expect(logs.entries.map((entry) => `${entry.level} ${entry.event}`)).toEqual([
      "error auth.email_otp.delivery_failed",
    ]);
  });
});
