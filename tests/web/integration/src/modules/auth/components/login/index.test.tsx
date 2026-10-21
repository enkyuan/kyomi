// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Login } from "@modules/auth/components/login";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const mocks = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isPending: false },
  prefetchInboxFlow: vi.fn(() => Promise.resolve()),
  router: {
    invalidate: vi.fn(() => Promise.resolve()),
    navigate: vi.fn(() => Promise.resolve()),
  },
  sendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp },
    signIn: { emailOtp: mocks.signInEmailOtp },
  },
}));

vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@modules/inbox/lib/navigation", () => ({
  prefetchInboxFlow: mocks.prefetchInboxFlow,
}));

vi.mock("@kyomi/ui/components/toast", () => ({
  toastManager: {
    add: mocks.toastAdd,
    promise: <Value,>(promise: Promise<Value>) => promise,
  },
}));

function renderLogin() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <Login redirect="/inbox" />
    </QueryClientProvider>,
  );
}

function getOtpInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('[data-slot="otp-field-input"]'));
}

async function submitEmail(email: string) {
  fireEvent.change(screen.getByPlaceholderText("Enter your email"), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  });
}

async function reachOtpStep(container: HTMLElement) {
  mocks.sendVerificationOtp.mockResolvedValue({ error: null });
  await submitEmail("reader@example.com");
  await screen.findByText("Enter verification code");
  return getOtpInputs(container);
}

beforeEach(() => {
  mocks.sendVerificationOtp.mockReset();
  mocks.signInEmailOtp.mockReset();
  mocks.toastAdd.mockReset();
  mocks.router.navigate.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Login", () => {
  test("keeps Continue loading while the sign-in code is being sent", async () => {
    const send = defer<{ error: null }>();
    mocks.sendVerificationOtp.mockReturnValue(send.promise);
    renderLogin();

    await submitEmail("reader@example.com");

    const button = screen.getByRole("button", { name: /Continue/ });
    expect(button.hasAttribute("data-loading")).toBe(true);
    expect(button).toHaveProperty("disabled", true);

    await act(async () => {
      send.resolve({ error: null });
    });

    expect(await screen.findByText("Enter verification code")).toBeTruthy();
  });

  test("verifies the code as soon as the sixth digit is entered", async () => {
    const verify = defer<{ error: null }>();
    mocks.signInEmailOtp.mockReturnValue(verify.promise);
    const { container } = renderLogin();
    const [firstInput] = await reachOtpStep(container);

    await act(async () => {
      fireEvent.change(firstInput!, { target: { value: "123456" } });
    });

    await waitFor(() => expect(mocks.signInEmailOtp).toHaveBeenCalledTimes(1));
    expect(mocks.signInEmailOtp).toHaveBeenCalledWith({
      email: "reader@example.com",
      otp: "123456",
      callbackURL: "/inbox",
    });
    expect(screen.getByRole("button", { name: /Continue/ }).hasAttribute("data-loading")).toBe(
      true,
    );

    await act(async () => {
      verify.resolve({ error: null });
    });

    await waitFor(() => expect(mocks.router.navigate).toHaveBeenCalledWith({ href: "/inbox" }));
  });

  test("waits for a complete code before verifying", async () => {
    const { container } = renderLogin();
    const [firstInput] = await reachOtpStep(container);

    await act(async () => {
      fireEvent.change(firstInput!, { target: { value: "12345" } });
    });

    expect(mocks.signInEmailOtp).not.toHaveBeenCalled();
  });

  test("reports a rejected code and lets the reader try again", async () => {
    mocks.signInEmailOtp.mockResolvedValue({ error: { message: "Invalid code" } });
    const { container } = renderLogin();
    const [firstInput] = await reachOtpStep(container);

    await act(async () => {
      fireEvent.change(firstInput!, { target: { value: "123456" } });
    });

    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Verification failed", type: "error" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Continue/ }).hasAttribute("data-loading")).toBe(
        false,
      ),
    );
    expect(mocks.router.navigate).not.toHaveBeenCalled();
  });
});
