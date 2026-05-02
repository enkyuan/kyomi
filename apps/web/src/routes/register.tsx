import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/features/auth";
import { requireGuest } from "./-guards";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    await requireGuest();
  },
  component: RegisterPage,
});
