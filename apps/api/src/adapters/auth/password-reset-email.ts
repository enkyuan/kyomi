import { logger } from "@adapters/logger";
import { env } from "@config/env";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DELIVERY_TIMEOUT_MS = 10_000;

type PasswordResetEmail = {
  to: string;
  url: string;
};

type PasswordResetEmailConfig = {
  apiKey?: string;
  from?: string;
  nodeEnv: "development" | "production" | "test";
};

type SendPasswordResetEmailOptions = {
  fetchImpl?: typeof fetch;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function createPasswordResetEmailBody({ url }: PasswordResetEmail) {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Reset your Kyomi password",
    text: `Reset your Kyomi password:\n\n${url}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
    html: `<p>Reset your Kyomi password using the link below.</p><p><a href="${safeUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
  };
}

export async function sendPasswordResetEmail(
  message: PasswordResetEmail,
  config: PasswordResetEmailConfig,
  options: SendPasswordResetEmailOptions = {},
): Promise<"delivered" | "development-link" | "unconfigured"> {
  if (!config.apiKey || !config.from) {
    if (config.nodeEnv !== "production") {
      logger.warn("auth.password_reset.development_link", { url: message.url });
      return "development-link";
    }

    logger.error("auth.password_reset.delivery_unconfigured");
    return "unconfigured";
  }

  const { subject, text, html } = createPasswordResetEmailBody(message);
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
    throw new Error(`Password reset email delivery failed with status ${response.status}`);
  }

  return "delivered";
}

export function queuePasswordResetEmail(message: PasswordResetEmail): void {
  void sendPasswordResetEmail(message, {
    apiKey: env.RESEND_API_KEY,
    from: env.AUTH_EMAIL_FROM,
    nodeEnv: env.NODE_ENV,
  }).catch((error) => {
    logger.error("auth.password_reset.delivery_failed", { error });
  });
}
