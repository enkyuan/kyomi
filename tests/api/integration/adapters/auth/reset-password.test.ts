import { describe, expect, mock, test } from "bun:test";
import {
  createResetPasswordEmailBody,
  sendResetPasswordEmail,
} from "@adapters/auth/reset-password";

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
    const fetchImpl = mock(async () => Response.json({ id: "email-id" }));

    await expect(
      sendResetPasswordEmail(
        {
          to: "reader@example.com",
          url: "https://kyomi.test/reset-password?token=abc",
        },
        {
          apiKey: "re_test",
          from: "Kyomi <auth@example.com>",
          nodeEnv: "production",
        },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).resolves.toBe("delivered");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "Kyomi <auth@example.com>",
      to: ["reader@example.com"],
      subject: "Reset your Kyomi password",
    });
  });

  test("reports an unconfigured production sender without making a request", async () => {
    const fetchImpl = mock(async () => Response.json({ id: "unexpected" }));

    await expect(
      sendResetPasswordEmail(
        { to: "reader@example.com", url: "https://kyomi.test/reset-password?token=abc" },
        { nodeEnv: "production" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).resolves.toBe("unconfigured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("fails when the delivery provider rejects the request", async () => {
    const fetchImpl = mock(async () => new Response(null, { status: 429 }));

    await expect(
      sendResetPasswordEmail(
        { to: "reader@example.com", url: "https://kyomi.test/reset-password?token=abc" },
        { apiKey: "re_test", from: "Kyomi <auth@example.com>", nodeEnv: "production" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow("status 429");
  });
});
