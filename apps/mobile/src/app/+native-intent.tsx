import { isOAuthRedirect } from "@modules/auth/oauth/lib/redirect";

// On Android the OAuth redirect also reaches the router as a deep link. AuthSession
// consumes it, so routing it would only land on +not-found.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (isOAuthRedirect(path)) {
    return initial ? "/" : null;
  }
  return path;
}
