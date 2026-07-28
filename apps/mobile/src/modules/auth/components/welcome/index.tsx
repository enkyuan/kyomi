import { buildAuthEntryHref } from "@kyomi/auth/redirect";
import { useRouter } from "expo-router";

import { navigate, useAuthSearch } from "../../lib/navigation";
import type { AuthWelcomeModel } from "../model";
import { AuthWelcomeView } from "./view";

export function WelcomeScreen() {
  const router = useRouter();
  const search = useAuthSearch();

  const model: AuthWelcomeModel = {
    wordmark: "Kyomi",
    title: "Get Started",
    description: "A personal reading inbox for the stories and sources you care about.",
    google: {
      label: "Continue with Google",
      enabled: false,
      onPress: () => undefined,
    },
    googleUnavailableMessage: "Google sign-in is coming soon.",
    email: {
      label: "Continue with Email",
      enabled: true,
      onPress: () => navigate(router, buildAuthEntryHref("/login", search.redirect)),
    },
    legalText: "By continuing, you agree to Kyomi’s Terms of Use.",
  };

  return <AuthWelcomeView model={model} />;
}
