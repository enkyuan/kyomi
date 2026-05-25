import { AppError } from "@shared/errors/app";

export type AuthContext = {
  userId: string;
};

type SessionResolver = {
  getSession: (args: {
    headers: Headers;
  }) => Promise<{ user?: { id?: string | null } | null } | null>;
};

export async function requireAuth(
  headers: Headers,
  sessionResolver?: SessionResolver,
): Promise<AuthContext> {
  const resolver = sessionResolver ?? (await import("@adapters/auth")).auth.api;

  const session = await resolver.getSession({ headers });
  if (!session?.user?.id) {
    throw new AppError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
  }

  return {
    userId: session.user.id,
  };
}
