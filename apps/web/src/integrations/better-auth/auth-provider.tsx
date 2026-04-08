"use client";

import { createContext, useContext, useMemo } from "react";
import { authClient } from "@lib/auth-client";

type SessionData = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;

export interface AuthState {
  user: SessionData["user"] | null;
  session: SessionData | null;
  isPending: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  isPending: true,
  isAuthenticated: false,
});

export default function AuthProvider({
  children,
  session: initialSession,
}: {
  children: React.ReactNode;
  session?: SessionData | null;
}) {
  const { data: liveSession, isPending } = authClient.useSession();
  const shouldUseInitialSession =
    isPending && liveSession == null && initialSession != null;
  const session = shouldUseInitialSession ? initialSession : (liveSession ?? null);
  const pending = isPending && session == null;

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      isPending: pending,
      isAuthenticated: Boolean(session?.user),
    }),
    [pending, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
