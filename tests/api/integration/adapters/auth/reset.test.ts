import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { createResetPasswordEmailBody, sendResetPasswordEmail } from "@adapters/auth/reset";
import { scriptedHttpClient, type ScriptedRequest } from "@api-tests/support/http";
import { recordingLogger, testConfig } from "@api-tests/support/layers";

const PRODUCTION_SENDER = {
  NODE_ENV: "production",
  RESEND_API_KEY: "re_test",
  AUTH_EMAIL_FROM: "Kyomi <auth@example.com>",
};

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

const message = { to: "reader@example.com", url: "https://kyomi.test/reset-password?token=abc" };

describe("reset password email", () => {
  test("escapes the reset URL in the HTML body", () => {
    const body = createResetPasswordEmailBody({
      to: "reader@example.com",
      url: "https://kyomi.test/reset-password?token=abc&redirect=/inbox",
    });

    expect(body.html).toContain("token=abc&amp;redirect=/inbox");
    expect(body.text).toContain("token=abc&redirect=/inbox");
  });

  test("sends the message through the Resend HTTP API", async () => {
    const { requests, layer } = delivery(PRODUCTION_SENDER, () =>
      Response.json({ id: "email-id" }),
    );

    const outcome = await Effect.runPromise(
      sendResetPasswordEmail(message).pipe(Effect.provide(layer)),
    );

    expect(outcome).toBe("delivered");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.resend.com/emails");
    expect(requests[0]?.headers.authorization).toBe("Bearer re_test");
    expect(JSON.parse(requests[0]?.body ?? "")).toMatchObject({
      from: "Kyomi <auth@example.com>",
      to: ["reader@example.com"],
      subject: "Reset your Kyomi password",
    });
  });

  test("logs the link when unconfigured outside production", async () => {
    const { requests, logs, layer } = delivery(
      { NODE_ENV: "development" },
      () => new Error("unexpected"),
    );

    const outcome = await Effect.runPromise(
      sendResetPasswordEmail(message).pipe(Effect.provide(layer)),
    );

    expect(outcome).toBe("development-link");
    expect(requests).toEqual([]);
    expect(logs.entries).toContainEqual({
      level: "warn",
      event: "auth.reset_password.development_link",
      context: { url: message.url },
    });
  });

  test("reports an unconfigured production sender without making a request", async () => {
    const { requests, layer } = delivery({ NODE_ENV: "production" }, () => new Error("unexpected"));

    const outcome = await Effect.runPromise(
      sendResetPasswordEmail(message).pipe(Effect.provide(layer)),
    );

    expect(outcome).toBe("unconfigured");
    expect(requests).toEqual([]);
  });

  test("fails when the delivery provider rejects the request", async () => {
    const { layer } = delivery(PRODUCTION_SENDER, () => new Response(null, { status: 429 }));

    const error = await Effect.runPromise(
      Effect.flip(sendResetPasswordEmail(message)).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "UpstreamError" });
    expect(String((error.cause as Error).message)).toContain("status 429");
  });
});
