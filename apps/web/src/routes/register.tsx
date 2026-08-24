import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateAuthSearch } from "@modules/auth/redirect";

export const Route = createFileRoute("/register")({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/",
      search: { redirect: search.redirect },
    });
  },
});
