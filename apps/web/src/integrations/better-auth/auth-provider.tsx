"use client";

import { createContext, useContext, useMemo } from "react";
import { authClient } from "@lib/auth-client";
import type { AuthSession } from "@lib/auth-functions";

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

export function normalizeInitialSession(initialSession?: AuthSession | null): SessionData | null {
  if (!initialSession?.session || !initialSession.user) {
    return null;
  }

  return {
    session: {
      ...initialSession.session,
      expiresAt: new Date(initialSession.session.expiresAt),
      createdAt: new Date(initialSession.session.createdAt),
      updatedAt: new Date(initialSession.session.updatedAt),
    },
    user: {
      ...initialSession.user,
      createdAt: new Date(initialSession.user.createdAt),
      updatedAt: new Date(initialSession.user.updatedAt),
    },
  } as SessionData;
}

export default function AuthProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: AuthSession | null;
}) {
  const { data: liveSession, isPending } = authClient.useSession();
  const normalizedInitialSession = useMemo(
    () => normalizeInitialSession(initialSession),
    [initialSession],
  );
  const shouldUseInitialSession =
    isPending && liveSession == null && normalizedInitialSession != null;
  const session = shouldUseInitialSession ? normalizedInitialSession : (liveSession ?? null);
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
