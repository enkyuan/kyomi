import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RouteErrorPage } from "@/app/error";
import { NotFoundPage } from "@/app/not-found";
import {
  getAuthRecoveryAction,
  INBOX_RECOVERY_ACTION,
  LOGIN_RECOVERY_ACTION,
} from "@/lib/recovery";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");

  return {
    Link: React.forwardRef<
      HTMLAnchorElement,
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
    >(({ to, ...props }, ref) => React.createElement("a", { ...props, href: to, ref })),
    useRouter: () => ({ invalidate: mocks.invalidate }),
  };
});

beforeEach(() => {
  mocks.invalidate.mockReset();
  mocks.invalidate.mockResolvedValue(undefined);
});

describe("RouteErrorPage", () => {
  test("invalidates the failed route before resetting its boundary", async () => {
    const reset = vi.fn();

    render(<RouteErrorPage error={new Error("Route failed")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(mocks.invalidate).toHaveBeenCalledOnce();
    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
  });

  test("resets the boundary when route invalidation reports another failure", async () => {
    const reset = vi.fn();
    mocks.invalidate.mockRejectedValueOnce(new Error("Still unavailable"));

    render(<RouteErrorPage error={new Error("Route failed")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
  });

  test("keeps root session failures retry-only", () => {
    render(<RouteErrorPage error={new Error("Unable to load your session.")} reset={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("uses the recovery action supplied by a protected route", () => {
    render(
      <RouteErrorPage
        error={new Error("Feed failed")}
        recoveryAction={INBOX_RECOVERY_ACTION}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Back to inbox" }).getAttribute("href")).toBe("/inbox");
  });
});

describe("NotFoundPage", () => {
  test.each([
    [LOGIN_RECOVERY_ACTION, "Go to login", "/"],
    [INBOX_RECOVERY_ACTION, "Back to inbox", "/inbox"],
  ] as const)("renders its route-owned recovery action", (recoveryAction, label, href) => {
    render(<NotFoundPage recoveryAction={recoveryAction} />);

    expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(href);
  });

  test("selects the public recovery target from resolved authentication", () => {
    expect(getAuthRecoveryAction({ status: "anonymous", session: null })).toBe(
      LOGIN_RECOVERY_ACTION,
    );
    expect(
      getAuthRecoveryAction({
        status: "authenticated",
        session: { session: {} as never, user: {} as never },
      }),
    ).toBe(INBOX_RECOVERY_ACTION);
  });
});
