import { describe, expect, mock, test } from "bun:test";
import { createEmailOTPBody, sendEmailOTP } from "@adapters/auth/email-otp";

describe("email OTP delivery", () => {
  test("formats the sign-in code in text and HTML body", () => {
    const body = createEmailOTPBody({
      to: "reader@example.com",
      otp: "123456",
    });

    expect(body.subject).toBe("Your Kyomi sign-in code");
    expect(body.text).toContain("123456");
    expect(body.html).toContain("123456");
  });

  test("sends the OTP code through the Resend HTTP API", async () => {
    const fetchImpl = mock(async () => Response.json({ id: "email-id" }));

    await expect(
      sendEmailOTP(
        {
          to: "reader@example.com",
          otp: "654321",
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
      subject: "Your Kyomi sign-in code",
    });
  });

  test("logs OTP to development log when unconfigured in non-production", async () => {
    const fetchImpl = mock(async () => Response.json({ id: "unexpected" }));

    await expect(
      sendEmailOTP(
        { to: "reader@example.com", otp: "112233" },
        { nodeEnv: "development" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).resolves.toBe("development-link");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("reports an unconfigured production sender without making a request", async () => {
    const fetchImpl = mock(async () => Response.json({ id: "unexpected" }));

    await expect(
      sendEmailOTP(
        { to: "reader@example.com", otp: "112233" },
        { nodeEnv: "production" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).resolves.toBe("unconfigured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("fails when the delivery provider rejects the request", async () => {
    const fetchImpl = mock(async () => new Response(null, { status: 429 }));

    await expect(
      sendEmailOTP(
        { to: "reader@example.com", otp: "112233" },
        { apiKey: "re_test", from: "Kyomi <auth@example.com>", nodeEnv: "production" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow("status 429");
  });
});
