import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ForgotPassword } from "@modules/auth/components/forgot-password";
import { ResetPassword } from "@modules/auth/components/reset-password";

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
  },
}));

describe("password reset", () => {
  beforeEach(() => {
    mocks.requestPasswordReset.mockReset().mockResolvedValue({ error: null });
    mocks.resetPassword.mockReset().mockResolvedValue({ error: null });
  });

  test("requests a reset without revealing whether the account exists", async () => {
    render(<ForgotPassword redirect="/inbox?filter=saved" usesDevelopmentLog />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: " reader@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(mocks.requestPasswordReset).toHaveBeenCalledOnce());
    expect(mocks.requestPasswordReset.mock.calls[0]?.[0]).toEqual({
      email: "reader@example.com",
      redirectTo: "http://localhost:3000/reset-password?redirect=%2Finbox%3Ffilter%3Dsaved",
    });
    expect(screen.getByText("Check your email")).toBeTruthy();
    expect(screen.getByText(/If an account exists/)).toBeTruthy();
    expect(screen.getByText(/reset link appears in the API log/)).toBeTruthy();
  });

  test("rejects an invalid or expired reset link", () => {
    render(<ResetPassword resetError />);

    expect(screen.getByText("Reset link expired")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Request a new password reset link" }),
    ).toBeTruthy();
  });

  test("updates the password with the reset token", async () => {
    render(<ResetPassword token="reset-token" />);

    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByPlaceholderText("Repeat your password"), {
      target: { value: "new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith({
        newPassword: "new-password",
        token: "reset-token",
      }),
    );
    expect(screen.getByText("Password updated")).toBeTruthy();
  });
});
