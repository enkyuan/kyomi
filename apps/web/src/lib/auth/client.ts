import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const baseURL =
  typeof window === "undefined"
    ? undefined
    : `${window.location.protocol}//${window.location.host}`;

export const authClient = createAuthClient({
  baseURL,
  plugins: [emailOTPClient()],
  sessionOptions: {
    refetchInterval: 5 * 60,
  },
});
