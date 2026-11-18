import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import { AppLogger } from "@adapters/logger/service";
import type { AppConfig } from "@config/env/service";
import { serializeError } from "@shared/errors/serialize";
import { deliverEmail } from "./resend";

type ResetPasswordEmail = {
  to: string;
  url: string;
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

/** Email the reset link. In development without a provider the link is logged instead. */
export const sendResetPasswordEmail = (message: ResetPasswordEmail) =>
  deliverEmail({
    to: message.to,
    content: createResetPasswordEmailBody(message),
    label: "Reset password email",
    events: {
      development: "auth.reset_password.development_link",
      unconfigured: "auth.reset_password.delivery_unconfigured",
    },
    developmentLog: { url: message.url },
  });

/** `sendResetPasswordEmail` for a background delivery: a failure is logged and never escapes. */
export const queueResetPasswordEmail = (
  message: ResetPasswordEmail,
): Effect.Effect<void, never, AppConfig | AppLogger | HttpClient.HttpClient> =>
  sendResetPasswordEmail(message).pipe(
    Effect.asVoid,
    Effect.catch((error) =>
      AppLogger.use((log) =>
        log.error("auth.reset_password.delivery_failed", { error: serializeError(error) }),
      ),
    ),
  );
