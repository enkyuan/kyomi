// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AccountPagePanel } from "@modules/settings/components/account";

const mocks = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  notify: vi.fn(),
  requestEmailChange: vi.fn(),
  router: { invalidate: vi.fn(() => Promise.resolve()), navigate: vi.fn(() => Promise.resolve()) },
  sendVerificationOtp: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock("@lib/auth/client", () => ({
  authClient: {
    $store: { notify: mocks.notify },
    emailOtp: {
      changeEmail: mocks.changeEmail,
      requestEmailChange: mocks.requestEmailChange,
      sendVerificationOtp: mocks.sendVerificationOtp,
    },
  },
}));

vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => ({
    session: null,
    user: { email: "reader@example.com" },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@kyomi/ui/components/toast", () => ({
  toastManager: { add: mocks.toastAdd },
}));

function otpInputs(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLInputElement>('[data-slot="otp-field-input"]'),
  );
}

async function enterCode(code: string) {
  await act(async () => {
    fireEvent.change(otpInputs()[0]!, { target: { value: code } });
  });
}

function requestedPaths(fetchMock: { mock: { calls: Array<Parameters<typeof fetch>> } }) {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost").pathname);
}

beforeEach(() => {
  mocks.changeEmail.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  mocks.requestEmailChange.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  mocks.sendVerificationOtp.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  mocks.notify.mockReset();
  mocks.router.invalidate.mockClear();
  mocks.toastAdd.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AccountPagePanel email", () => {
  test("changes the email through the Better Auth client and never calls the removed profile route", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(Response.json([])));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AccountPagePanel onLogout={() => Promise.resolve()} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit email" }));
    });

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    });
    await screen.findByText("Confirm it is you");
    await enterCode("111111");
    await screen.findByText("Verify your new email");
    await enterCode("222222");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({
      email: "reader@example.com",
      type: "email-verification",
    });
    expect(mocks.requestEmailChange).toHaveBeenCalledWith({
      newEmail: "new@example.com",
      otp: "111111",
    });
    expect(mocks.changeEmail).toHaveBeenCalledWith({ newEmail: "new@example.com", otp: "222222" });
    expect(mocks.router.invalidate).toHaveBeenCalled();
    expect(requestedPaths(fetchSpy)).not.toContain("/api/v1/users/profile/email");
    expect(requestedPaths(fetchSpy).every((path) => path === "/api/auth/list-sessions")).toBe(true);
  });

  test("discards the entered address and codes when the dialog is cancelled", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(Response.json([])));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AccountPagePanel onLogout={() => Promise.resolve()} />
      </QueryClientProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit email" }));
    });
    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit email" }));
    });

    expect(screen.getByLabelText<HTMLInputElement>("New email address").value).toBe("");
    expect(mocks.sendVerificationOtp).not.toHaveBeenCalled();
  });
});
