import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import { randomUUID } from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { logClientError } from "@kyomi/reader/lib/errors";
import { authClient, resolveAuthOrigin } from "@/lib/auth";
import { useAuthCapabilities } from "@modules/auth/hooks/use-auth-capabilities";
import { OAUTH_CLIENT_ID, OAUTH_REDIRECT_URI } from "../constants";

type OAuthProvider = "google";

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
};

// The API brokers the provider sign-in and issues the authorization code, so the
// provider's own client credentials never reach the app.
const discovery = {
  authorizationEndpoint: `${resolveAuthOrigin()}/api/auth/oauth/authorize`,
};

// `native` pins the registered URI in development and release builds alike.
const redirectUri = makeRedirectUri({ native: OAUTH_REDIRECT_URI });

// The API registers only the app's custom-scheme redirect, which the web fallback cannot
// receive.
const isSupportedPlatform = Platform.OS !== "web";

export function useOAuthSignIn(provider: OAuthProvider) {
  // A fresh state per attempt makes the hook rebuild the request with a new PKCE verifier.
  const [state, setState] = useState(randomUUID);
  const [isPending, setIsPending] = useState(false);
  const capabilities = useAuthCapabilities({ enabled: isSupportedPlatform });
  const [request, , promptAsync] = useAuthRequest(
    { clientId: OAUTH_CLIENT_ID, redirectUri, state, extraParams: { provider } },
    discovery,
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;
    // Lets Custom Tabs initialize before the user asks to sign in.
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  async function authorize() {
    if (!request) return;
    const result = await promptAsync();
    if (result.type === "error") {
      // The user declining consent is a cancellation, not a failure.
      if (result.error?.code === "access_denied") return;
      throw result.error ?? new Error("Authorization failed");
    }
    if (result.type !== "success") return;

    // The token response sets the session cookie, which the Expo auth client stores
    // and turns into a session refresh.
    const { error } = await authClient.$fetch("/oauth/token", {
      method: "POST",
      body: {
        grant_type: "authorization_code",
        client_id: OAUTH_CLIENT_ID,
        redirect_uri: redirectUri,
        code: result.params.code,
        code_verifier: request.codeVerifier,
      },
    });
    if (error) {
      throw new Error(error.message ?? `Token exchange failed with ${error.status}`);
    }
  }

  function signIn() {
    if (isPending) return;
    setIsPending(true);
    void authorize()
      .catch((error: unknown) => {
        logClientError("useOAuthSignIn", error);
        Alert.alert(`Couldn't sign in with ${PROVIDER_LABELS[provider]}`, "Try again in a moment.");
      })
      .finally(() => {
        setIsPending(false);
        setState(randomUUID());
      });
  }

  return {
    isReady:
      isSupportedPlatform &&
      capabilities.data?.[provider] === true &&
      request?.state === state &&
      !isPending,
    signIn,
  };
}
