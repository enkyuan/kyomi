import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@pages/auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});
