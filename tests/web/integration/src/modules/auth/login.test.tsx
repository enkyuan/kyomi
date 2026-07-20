import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Login } from "@modules/auth/components/login";

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isPending: false,
  },
  invalidate: vi.fn(),
  navigate: vi.fn(),
  prefetchInboxFlow: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  toastAdd: vi.fn(),
  toastPromise: vi.fn((promise: Promise<unknown>) => promise),
}));

vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
    signIn: {
      email: mocks.signInEmail,
      social: mocks.signInSocial,
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    invalidate: mocks.invalidate,
    navigate: mocks.navigate,
  }),
}));

vi.mock("@modules/inbox", () => ({
  prefetchInboxFlow: mocks.prefetchInboxFlow,
}));

vi.mock("@kyomi/ui/toast", () => ({
  toastManager: {
    add: mocks.toastAdd,
    promise: mocks.toastPromise,
  },
}));

describe("Login", () => {
  beforeEach(() => {
    Object.assign(mocks.auth, { isAuthenticated: false, isPending: false });
    mocks.invalidate.mockReset().mockResolvedValue(undefined);
    mocks.navigate.mockReset().mockResolvedValue(undefined);
    mocks.prefetchInboxFlow.mockReset().mockResolvedValue(undefined);
    mocks.signInEmail.mockReset().mockResolvedValue({ error: null });
    mocks.signInSocial.mockReset().mockResolvedValue({ error: null });
    mocks.toastAdd.mockReset();
    mocks.toastPromise.mockClear();
  });

  test("keeps optional actions hidden when their capabilities are disabled", () => {
    render(<Login />);

    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
  });

  test("shows Google and password recovery without competing with the primary action", async () => {
    render(<Login googleOAuthEnabled passwordResetEnabled redirect="/inbox?filter=saved" />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe(
      "/forgot-password?redirect=%2Finbox%3Ffilter%3Dsaved",
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/inbox?filter=saved",
        errorCallbackURL: "/?authError=oauth&redirect=%2Finbox%3Ffilter%3Dsaved",
      }),
    );
  });

  test("shows a compact OAuth callback error", () => {
    render(<Login authError="oauth" googleOAuthEnabled />);
    expect(screen.getByRole("alert").textContent).toContain("couldn’t be completed");
  });
});
