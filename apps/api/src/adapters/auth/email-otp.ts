import { logger } from "@adapters/logger";
import { env } from "@config/env";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DELIVERY_TIMEOUT_MS = 10_000;

type EmailOTPMessage = {
  to: string;
  otp: string;
};

type EmailOTPConfig = {
  apiKey?: string;
  from?: string;
  nodeEnv: "development" | "production" | "test";
};

type SendEmailOTPOptions = {
  fetchImpl?: typeof fetch;
};

export function createEmailOTPBody({ otp }: EmailOTPMessage) {
  return {
    subject: "Your Kyomi sign-in code",
    text: `Your Kyomi sign-in code is ${otp}\n\nThis code expires in 5 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your Kyomi sign-in code is:</p><p style="font-size:24px;font-weight:600;letter-spacing:4px;">${otp}</p><p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
  };
}

export async function sendEmailOTP(
  message: EmailOTPMessage,
  config: EmailOTPConfig,
  options: SendEmailOTPOptions = {},
): Promise<"delivered" | "development-link" | "unconfigured"> {
  if (!config.apiKey || !config.from) {
    if (config.nodeEnv !== "production") {
      logger.warn("auth.email_otp.development_log", { otp: message.otp });
      return "development-link";
    }

    logger.error("auth.email_otp.delivery_unconfigured");
    return "unconfigured";
  }

  const { subject, text, html } = createEmailOTPBody(message);
  const response = await (options.fetchImpl ?? fetch)(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject,
      text,
      html,
    }),
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Email OTP delivery failed with status ${response.status}`);
  }

  return "delivered";
}

export function queueEmailOTP(message: EmailOTPMessage): void {
  void sendEmailOTP(message, {
    apiKey: env.RESEND_API_KEY,
    from: env.AUTH_EMAIL_FROM,
    nodeEnv: env.NODE_ENV,
  }).catch((error) => {
    logger.error("auth.email_otp.delivery_failed", { error });
  });
}
