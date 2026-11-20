import { isOAuthRedirect } from "@modules/auth/oauth/lib/redirect";

// The longest link the app receives is the OAuth redirect, well under 500 characters. Expo Router
// decodes every percent escape in an incoming path with a decoder that is quadratic in its length,
// so a longer one is dropped here, before the router sees it.
const MAX_PATH_LENGTH = 2048;

// On Android the OAuth redirect also reaches the router as a deep link. AuthSession
// consumes it, so routing it would only land on +not-found.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.length > MAX_PATH_LENGTH || isOAuthRedirect(path)) {
    return initial ? "/" : null;
  }
  return path;
}
