import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Register } from "@modules/auth/components/register";

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isPending: false,
  },
  invalidate: vi.fn(),
  navigate: vi.fn(),
  prefetchInboxFlow: vi.fn(),
  signInSocial: vi.fn(),
  signUp: vi.fn(),
  toastAdd: vi.fn(),
  toastPromise: vi.fn((promise: Promise<unknown>) => promise),
}));

vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
    signIn: {
      social: mocks.signInSocial,
    },
    signUp: {
      email: mocks.signUp,
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

vi.mock("@kyomi/ui/atoms/toast", () => ({
  toastManager: {
    add: mocks.toastAdd,
    promise: mocks.toastPromise,
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("Register", () => {
  beforeEach(() => {
    Object.assign(mocks.auth, {
      isAuthenticated: false,
      isPending: false,
    });
    mocks.invalidate.mockReset();
    mocks.navigate.mockReset().mockResolvedValue(undefined);
    mocks.prefetchInboxFlow.mockReset().mockResolvedValue(undefined);
    mocks.signInSocial.mockReset().mockResolvedValue({ error: null });
    mocks.signUp.mockReset().mockResolvedValue({ error: null });
    mocks.toastAdd.mockReset();
    mocks.toastPromise.mockClear();
  });

  test("shows the loading screen while the initial session is unresolved", () => {
    mocks.auth.isPending = true;

    render(<Register />);

    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByText("Create an account")).toBeNull();
  });

  test("keeps the signup state visible while the new session is being resolved", async () => {
    const invalidation = createDeferred<void>();
    mocks.invalidate.mockReturnValueOnce(invalidation.promise);
    const view = render(<Register />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Repeat your password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledOnce());
    expect(screen.getByText("Creating account…")).toBeTruthy();

    mocks.auth.isPending = true;
    view.rerender(<Register />);

    expect(screen.getByText("Create your account")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();

    invalidation.resolve();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce());
  });

  test("starts Google sign-in with the register return path", async () => {
    render(<Register googleOAuthEnabled redirect="/inbox?filter=all" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/inbox?filter=all",
        errorCallbackURL: "/register?authError=oauth&redirect=%2Finbox%3Ffilter%3Dall",
      });
    });
  });
});
