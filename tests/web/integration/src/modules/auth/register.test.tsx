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
  signUp: vi.fn(),
  toastPromise: vi.fn((promise: Promise<unknown>) => promise),
}));

vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
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

vi.mock("@kyomi/ui/toast", () => ({
  toastManager: {
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
    mocks.signUp.mockReset().mockResolvedValue({ error: null });
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

    fireEvent.change(screen.getByPlaceholderText("Enter your email"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Create a password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm your password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledOnce());
    expect(screen.getByText("Signing up…")).toBeTruthy();

    mocks.auth.isPending = true;
    view.rerender(<Register />);

    expect(screen.getByText("Create an account")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();

    invalidation.resolve();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce());
  });
});
