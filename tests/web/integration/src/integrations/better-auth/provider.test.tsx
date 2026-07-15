import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AuthProvider, { useAuth } from "@integrations/better-auth/provider";
import type { AuthSession } from "@lib/auth/session";

const mocks = vi.hoisted(() => ({
  sessionState: {
    data: null as unknown,
    error: null as { status?: number } | null,
    isPending: true,
    isRefetching: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
    useSession: () => mocks.sessionState,
  },
}));

const initialSession: NonNullable<AuthSession> = {
  session: {
    id: "session-1",
    expiresAt: "2026-07-15T12:00:00.000Z",
    token: "token",
    createdAt: "2026-07-14T12:00:00.000Z",
    updatedAt: "2026-07-14T12:00:00.000Z",
    userId: "user-1",
  },
  user: {
    id: "user-1",
    email: "reader@example.com",
    emailVerified: true,
    name: "Reader",
    createdAt: "2026-07-14T12:00:00.000Z",
    updatedAt: "2026-07-14T12:00:00.000Z",
  },
};

function AuthProbe() {
  const { isAuthenticated, isPending, user } = useAuth();
  return (
    <output>{JSON.stringify({ email: user?.email ?? null, isAuthenticated, isPending })}</output>
  );
}

beforeEach(() => {
  Object.assign(mocks.sessionState, {
    data: null,
    error: null,
    isPending: true,
  });
});

describe("AuthProvider", () => {
  test("hydrates from the server session while the client request is pending", () => {
    render(
      <AuthProvider initialSession={initialSession}>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByText(/reader@example\.com/).textContent).toContain('"isAuthenticated":true');
  });

  test("retains the server session when the client session request is unavailable", () => {
    Object.assign(mocks.sessionState, {
      error: { status: 503 },
      isPending: false,
    });

    render(
      <AuthProvider initialSession={initialSession}>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByText(/reader@example\.com/).textContent).toContain('"isAuthenticated":true');
  });

  test.each([null, { status: 401 }])(
    "clears the server session when the client confirms it is anonymous",
    (error) => {
      Object.assign(mocks.sessionState, {
        error,
        isPending: false,
      });

      render(
        <AuthProvider initialSession={initialSession}>
          <AuthProbe />
        </AuthProvider>,
      );

      expect(screen.getByText(/"email":null/).textContent).toContain('"isAuthenticated":false');
    },
  );
});
