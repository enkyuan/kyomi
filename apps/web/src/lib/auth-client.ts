import { createAuthClient } from "better-auth/react";

const baseURL =
  typeof window === "undefined"
    ? undefined
    : `${window.location.protocol}//${window.location.host}`;

export const authClient = createAuthClient({
  baseURL,
});
