import { createFileRoute } from "@tanstack/react-router";
import { Login } from "@modules/auth";
import { useAuthRedirect } from "@modules/auth/hooks/use-redirect";
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
  const { redirect } = Route.useSearch();
  return <Login register redirect={useAuthRedirect(redirect)} />;
}
