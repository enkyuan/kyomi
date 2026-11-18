import { emailOTP } from "better-auth/plugins";
import type { EmailOTPMessage } from "./otp";

/**
 * The email OTP plugin. Signing in and changing the address are the only flows that send a code.
 *
 * `changeEmail` is Better Auth's own verified flow: the code goes to the new address and the
 * address only changes once it is entered, so nobody can claim an address they cannot read. A
 * signed-in user must never be able to set their email directly: an unverified change lets them
 * take an address before its owner signs up, and the owner's first sign-in then lands in this
 * account.
 */
export function emailOtpPlugin(sendOtp: (message: EmailOTPMessage) => void) {
  return emailOTP({
    changeEmail: { enabled: true },
    sendVerificationOTP: async ({ email, otp, type }) => {
      sendOtp({ to: email, otp, purpose: type === "change-email" ? "change-email" : "sign-in" });
    },
  });
}
