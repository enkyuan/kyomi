// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EmailDialog } from "@modules/settings/components/account/email-dialog";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

type AuthFailure = { code?: string; message?: string; status: number; statusText: string };

const OK = { data: { success: true }, error: null };

function failure(status: number, code?: string, message?: string) {
  return { data: null, error: { code, message, status, statusText: "" } satisfies AuthFailure };
}

const mocks = vi.hoisted(() => ({
  calls: [] as Array<[string, unknown]>,
  changeEmail: vi.fn(),
  notify: vi.fn(),
  requestEmailChange: vi.fn(),
  router: { invalidate: vi.fn(() => Promise.resolve()) },
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

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@kyomi/ui/components/toast", () => ({
  toastManager: { add: mocks.toastAdd },
}));

const CURRENT = "reader@example.com";
const NEXT = "new@example.com";

function record(name: string, result: unknown) {
  return (args: unknown) => {
    mocks.calls.push([name, args]);
    return Promise.resolve(result);
  };
}

function renderDialog() {
  const onOpenChange = vi.fn();
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <EmailDialog currentEmail={CURRENT} onOpenChange={onOpenChange} open />
    </QueryClientProvider>,
  );

  return { invalidate, onOpenChange };
}

function otpInputs(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLInputElement>('[data-slot="otp-field-input"]'),
  );
}

async function click(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function submitAddress(value: string) {
  fireEvent.change(screen.getByLabelText("New email address"), { target: { value } });
  await click(/^Continue$/);
}

async function enterCode(code: string) {
  await act(async () => {
    fireEvent.change(otpInputs()[0]!, { target: { value: code } });
  });
}

async function reachCurrentStep() {
  await submitAddress(NEXT);
  await screen.findByText("Confirm it is you");
}

async function reachNewStep() {
  await reachCurrentStep();
  await enterCode("111111");
  await screen.findByText("Verify your new email");
}

function dialog() {
  return within(screen.getByRole("dialog"));
}

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.changeEmail.mockReset().mockImplementation(record("changeEmail", OK));
  mocks.requestEmailChange.mockReset().mockImplementation(record("requestEmailChange", OK));
  mocks.sendVerificationOtp.mockReset().mockImplementation(record("sendVerificationOtp", OK));
  mocks.notify.mockReset();
  mocks.router.invalidate.mockClear();
  mocks.toastAdd.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EmailDialog change-email flow", () => {
  test("verifies the current mailbox, then the new one, with the exact calls in order", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { invalidate, onOpenChange } = renderDialog();

    await submitAddress("  New@Example.com  ");
    await screen.findByText("Confirm it is you");
    expect(mocks.calls).toEqual([
      ["sendVerificationOtp", { email: CURRENT, type: "email-verification" }],
    ]);
    expect(dialog().getByText(CURRENT)).toBeTruthy();

    await enterCode("111111");
    await screen.findByText("Verify your new email");
    expect(mocks.calls).toEqual([
      ["sendVerificationOtp", { email: CURRENT, type: "email-verification" }],
      ["requestEmailChange", { newEmail: "New@Example.com", otp: "111111" }],
    ]);
    expect(dialog().getByText("New@Example.com")).toBeTruthy();
    // The server answers the same for a registered and an unregistered address.
    expect(screen.queryByText(/already|registered|taken|in use/i)).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();

    await enterCode("222222");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    expect(mocks.calls).toEqual([
      ["sendVerificationOtp", { email: CURRENT, type: "email-verification" }],
      ["requestEmailChange", { newEmail: "New@Example.com", otp: "111111" }],
      ["changeEmail", { newEmail: "New@Example.com", otp: "222222" }],
    ]);
    expect(mocks.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: "New@Example.com", title: "Email updated" }),
    );
    expect(mocks.notify).toHaveBeenCalledWith("$sessionSignal");
    expect(mocks.router.invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["auth", "sessions"] });
    // The removed route is never contacted: every call goes through the Better Auth client.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("lets the user retry a rejected current-mailbox code without leaving the step", async () => {
    mocks.requestEmailChange.mockImplementationOnce(
      record("requestEmailChange", failure(400, "INVALID_OTP", "Invalid OTP")),
    );
    renderDialog();
    await reachCurrentStep();

    await enterCode("000000");

    expect((await screen.findByText(/That code is incorrect/)).textContent).toContain("try again");
    expect(screen.getByText("Confirm it is you")).toBeTruthy();
    expect(otpInputs().every((input) => input.getAttribute("aria-invalid") === "true")).toBe(true);
    expect(mocks.changeEmail).not.toHaveBeenCalled();

    await enterCode("111111");

    await screen.findByText("Verify your new email");
    expect(screen.queryByText(/That code is incorrect/)).toBeNull();
    expect(mocks.requestEmailChange).toHaveBeenCalledTimes(2);
  });

  test("lets the user retry a rejected new-mailbox code and then closes", async () => {
    mocks.changeEmail.mockImplementationOnce(
      record("changeEmail", failure(400, "INVALID_OTP", "Invalid OTP")),
    );
    const { onOpenChange } = renderDialog();
    await reachNewStep();

    await enterCode("000000");

    await screen.findByText(/That code is incorrect/);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.router.invalidate).not.toHaveBeenCalled();

    await enterCode("222222");

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.changeEmail).toHaveBeenCalledTimes(2);
    expect(mocks.changeEmail).toHaveBeenLastCalledWith({ newEmail: NEXT, otp: "222222" });
  });

  test("tells the user to start again when the new-mailbox code is spent, keeping the address", async () => {
    mocks.changeEmail.mockImplementationOnce(
      record("changeEmail", failure(400, "OTP_EXPIRED", "OTP expired")),
    );
    renderDialog();
    await reachNewStep();

    await enterCode("222222");

    expect((await screen.findByText(/That code has expired/)).textContent).toContain(
      "Go back and start again",
    );

    await click(/Use a different address/);

    const input = screen.getByLabelText<HTMLInputElement>("New email address");
    expect(input.value).toBe(NEXT);
    expect(screen.queryByText(/That code has expired/)).toBeNull();
  });

  test("offers a new current-mailbox code after too many wrong attempts", async () => {
    mocks.requestEmailChange.mockImplementationOnce(
      record("requestEmailChange", failure(403, "TOO_MANY_ATTEMPTS", "Too many attempts")),
    );
    renderDialog();
    await reachCurrentStep();

    await enterCode("000000");

    expect((await screen.findByText(/Too many incorrect attempts/)).textContent).toContain(
      "Send a new code",
    );

    await click(/Resend code/);

    await waitFor(() => expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(2));
    expect(mocks.sendVerificationOtp).toHaveBeenLastCalledWith({
      email: CURRENT,
      type: "email-verification",
    });
    expect(mocks.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "Code sent" }));
    expect(screen.queryByText(/Too many incorrect attempts/)).toBeNull();
  });

  test("returns to the address when the server rejects it after the first code", async () => {
    mocks.requestEmailChange.mockImplementationOnce(
      record("requestEmailChange", failure(400, "INVALID_EMAIL", "Invalid email")),
    );
    renderDialog();
    await reachCurrentStep();

    await enterCode("111111");

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>("New email address").value).toBe(NEXT);
    expect(mocks.changeEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["is not an email address", "not-an-email", "Enter a valid email address."],
    ["is empty", "", "Enter a valid email address."],
    ["is the current address", "READER@example.com", "Enter a different email address."],
  ])("does not advance when the new address %s", async (_name, value, message) => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("New email address"), { target: { value } });
    // Nothing is flagged while the user is still typing.
    expect(screen.queryByText(message)).toBeNull();

    await click(/^Continue$/);

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByText("Change email")).toBeTruthy();
    expect(mocks.sendVerificationOtp).not.toHaveBeenCalled();
    expect(mocks.requestEmailChange).not.toHaveBeenCalled();
    expect(mocks.changeEmail).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: NEXT } });
    expect(screen.queryByText(message)).toBeNull();
  });

  test("waits for a complete code before contacting the server", async () => {
    renderDialog();
    await reachCurrentStep();

    await enterCode("12345");

    expect(mocks.requestEmailChange).not.toHaveBeenCalled();

    await click(/^Continue$/);

    expect(await screen.findByText("Enter the 6-digit code sent to your email.")).toBeTruthy();
    expect(mocks.requestEmailChange).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm it is you")).toBeTruthy();
  });

  test("reports a rate limit on sending the first code and lets the user retry", async () => {
    mocks.sendVerificationOtp.mockImplementationOnce(
      record("sendVerificationOtp", failure(429, undefined, "Too many requests")),
    );
    renderDialog();

    await submitAddress(NEXT);

    expect(await screen.findByText(/Too many attempts\. Wait a minute/)).toBeTruthy();
    expect(screen.getByText("Change email")).toBeTruthy();

    await click(/^Continue$/);

    await screen.findByText("Confirm it is you");
    expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(2);
  });

  test("reports an expired session instead of advancing", async () => {
    mocks.requestEmailChange.mockImplementationOnce(
      record("requestEmailChange", failure(401, "UNAUTHORIZED", "Unauthorized")),
    );
    renderDialog();
    await reachCurrentStep();

    await enterCode("111111");

    expect(await screen.findByText("Your session has expired. Sign in again.")).toBeTruthy();
    expect(screen.getByText("Confirm it is you")).toBeTruthy();
  });

  test("keeps the step and shows a generic error when the request itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.requestEmailChange.mockImplementationOnce(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    renderDialog();
    await reachCurrentStep();

    await enterCode("111111");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
    expect(screen.getByText("Confirm it is you")).toBeTruthy();
  });

  test("sends one request when a code is submitted twice while the first is in flight", async () => {
    const pending = defer<typeof OK>();
    mocks.requestEmailChange.mockImplementationOnce(() => pending.promise);
    renderDialog();
    await reachCurrentStep();

    await enterCode("111111");
    const form = screen.getByRole("dialog").querySelector("form")!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(mocks.requestEmailChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(OK);
    });
    await screen.findByText("Verify your new email");
    expect(mocks.requestEmailChange).toHaveBeenCalledTimes(1);
  });

  test("never sends a verification code to an address the user typed", async () => {
    renderDialog();

    await submitAddress("someone-else@example.com");
    await screen.findByText("Confirm it is you");
    await click(/Resend code/);

    await waitFor(() => expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(2));
    for (const [args] of mocks.sendVerificationOtp.mock.calls) {
      expect(args).toEqual({ email: CURRENT, type: "email-verification" });
    }
  });
});
