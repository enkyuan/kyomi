import { createFileRoute } from "@tanstack/react-router";
import { Register } from "@modules/auth";
import { requireGuest } from "./-guards";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    await requireGuest();
  },
  component: Register,
});
