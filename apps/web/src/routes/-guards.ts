import { redirect } from "@tanstack/react-router";
import { getSession } from "@lib/auth-functions";

export async function requireAuth() {
  // Route truth is server-grounded; client auth cache only hydrates UI.
  const session = await getSession();

  if (!session?.user) {
    throw redirect({ to: "/" });
  }
}

export async function requireGuest() {
  // Prevent guest-page flashes for authenticated users by redirecting in server-aware guard.
  const session = await getSession();

  if (session?.user) {
    throw redirect({ to: "/inbox" });
  }
}
