import { OAUTH_REDIRECT_URI } from "../constants";

/** Whether an incoming link is the OAuth redirect that AuthSession consumes itself. */
export function isOAuthRedirect(url: string): boolean {
  return url === OAUTH_REDIRECT_URI || url.startsWith(`${OAUTH_REDIRECT_URI}?`);
}
