import { redirect } from "@tanstack/react-router";
import { getSession } from "@lib/auth-functions";

export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    throw redirect({ to: "/" });
  }
}

export async function requireGuest() {
  const session = await getSession();

  if (session?.user) {
    throw redirect({ to: "/inbox" });
  }
}
