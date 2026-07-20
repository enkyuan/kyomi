import { createFileRoute } from "@tanstack/react-router";
import { Register } from "@modules/auth";
import { useAuthReturnTarget } from "@modules/auth/hooks/use-auth-return-target";
import { validateAuthSearch } from "@modules/auth/redirect";
import { requireGuest } from "./-guards";

export const Route = createFileRoute("/register")({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => {
    requireGuest(context.authState, search.redirect);
  },
  component: RegisterRoute,
});

function RegisterRoute() {
  const { redirect, authError } = Route.useSearch();
  const { authCapabilities } = Route.useRouteContext();
  return (
    <Register
      authError={authError}
      googleOAuthEnabled={authCapabilities.google}
      redirect={useAuthReturnTarget(redirect)}
    />
  );
}
