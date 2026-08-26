import { logger } from "@adapters/logger";
import { env } from "@config/env";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DELIVERY_TIMEOUT_MS = 10_000;

type ResetPasswordEmail = {
  to: string;
  url: string;
};

type ResetPasswordEmailConfig = {
  apiKey?: string;
  from?: string;
  nodeEnv: "development" | "production" | "test";
};

type SendResetPasswordEmailOptions = {
  fetchImpl?: typeof fetch;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function createResetPasswordEmailBody({ url }: ResetPasswordEmail) {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Reset your Kyomi password",
    text: `Reset your Kyomi password:\n\n${url}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
    html: `<p>Reset your Kyomi password using the link below.</p><p><a href="${safeUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
  };
}

export async function sendResetPasswordEmail(
  message: ResetPasswordEmail,
  config: ResetPasswordEmailConfig,
  options: SendResetPasswordEmailOptions = {},
): Promise<"delivered" | "development-link" | "unconfigured"> {
  if (!config.apiKey || !config.from) {
    if (config.nodeEnv !== "production") {
      logger.warn("auth.reset_password.development_link", { url: message.url });
      return "development-link";
    }

    logger.error("auth.reset_password.delivery_unconfigured");
    return "unconfigured";
  }

  const { subject, text, html } = createResetPasswordEmailBody(message);
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
    throw new Error(`Reset password email delivery failed with status ${response.status}`);
  }

  return "delivered";
}

export function queueResetPasswordEmail(message: ResetPasswordEmail): void {
  void sendResetPasswordEmail(message, {
    apiKey: env.RESEND_API_KEY,
    from: env.AUTH_EMAIL_FROM,
    nodeEnv: env.NODE_ENV,
  }).catch((error) => {
    logger.error("auth.reset_password.delivery_failed", { error });
  });
}
