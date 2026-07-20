import { createFileRoute } from "@tanstack/react-router";
import { Login } from "@modules/auth";
import { useAuthReturnTarget } from "@modules/auth/hooks/use-auth-return-target";
import { validateAuthSearch } from "@modules/auth/redirect";
import { requireGuest } from "./-guards";

export const Route = createFileRoute("/")({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => {
    requireGuest(context.authState, search.redirect);
  },
  component: LoginRoute,
});

function LoginRoute() {
  const { redirect, authError } = Route.useSearch();
  const { authCapabilities } = Route.useRouteContext();
  return (
    <Login
      authError={authError}
      googleOAuthEnabled={authCapabilities.google}
      passwordResetEnabled={authCapabilities.passwordReset}
      redirect={useAuthReturnTarget(redirect)}
    />
  );
}
