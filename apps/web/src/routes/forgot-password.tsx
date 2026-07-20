import { createFileRoute } from "@tanstack/react-router";
import { ForgotPassword } from "@modules/auth";
import { validateAuthSearch } from "@modules/auth/redirect";
import { requireGuest } from "./-guards";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => {
    requireGuest(context.authState, search.redirect);
  },
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const { redirect } = Route.useSearch();
  const { authCapabilities } = Route.useRouteContext();
  return (
    <ForgotPassword
      redirect={redirect}
      usesDevelopmentLog={authCapabilities.passwordResetUsesDevelopmentLog}
    />
  );
}
