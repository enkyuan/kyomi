import { createFileRoute } from "@tanstack/react-router";
import { Login } from "@modules/auth";
import { requireGuest } from "./-guards";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await requireGuest();
  },
  component: Login,
});
