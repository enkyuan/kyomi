import { createFileRoute } from "@tanstack/react-router";
import { ResetPassword } from "@modules/auth";
import { validateResetPasswordSearch } from "@modules/auth/redirect";

export const Route = createFileRoute("/reset-password")({
  validateSearch: validateResetPasswordSearch,
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { token, resetError, redirect } = Route.useSearch();
  return <ResetPassword token={token} resetError={resetError} redirect={redirect} />;
}
