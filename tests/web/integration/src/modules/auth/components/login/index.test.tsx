import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Login } from "@modules/auth/components/login";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  navigate: vi.fn(),
  send: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn().mockResolvedValue(undefined), navigate: mocks.navigate }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => ({ isAuthenticated: false, isPending: false }),
}));
vi.mock("@lib/auth/client", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mocks.send },
    signIn: { emailOtp: mocks.signIn },
  },
}));
vi.mock("@modules/inbox/lib/navigation", () => ({ prefetchInboxFlow: vi.fn() }));
vi.mock("@kyomi/ui/components/toast", () => ({
  toastManager: { add: mocks.add, promise: (promise: Promise<unknown>) => promise },
}));
vi.mock("@kyomi/ui/components/otp-field", () => ({
  OTPField: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <input
      aria-label="Verification code"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
  OTPFieldInput: () => null,
  OTPFieldSeparator: () => null,
}));

async function openCodeStep() {
  mocks.send.mockResolvedValue({ error: null });
  render(<Login redirect="/inbox" />);
  fireEvent.change(screen.getByPlaceholderText("Enter your email"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Enter verification code");
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.add.mockReset();
  mocks.navigate.mockReset();
  mocks.send.mockReset();
  mocks.signIn.mockReset();
});

describe("Login verification toasts", () => {
  test("announces only the successful login, never a verifying toast", async () => {
    mocks.signIn.mockResolvedValue({ error: null });
    await openCodeStep();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ href: "/inbox" }));
    expect(mocks.add).toHaveBeenCalledTimes(1);
    expect(mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Logged in", type: "success" }),
    );
  });

  test("announces a failed verification instead of a login", async () => {
    mocks.signIn.mockResolvedValue({ error: { message: "That code has expired" } });
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      await openCodeStep();

      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() =>
        expect(mocks.add).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Verification failed", type: "error" }),
        ),
      );
      expect(mocks.add).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Logged in" }));
      expect(mocks.navigate).not.toHaveBeenCalled();
      // The toast reports the failure; the form must not also leave an unhandled rejection.
      // gstack-timing-ok: zero-delay macrotask flush so a pending rejection would surface; no wall-clock bound
      await new Promise((resolve) => setTimeout(resolve));
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });
});
