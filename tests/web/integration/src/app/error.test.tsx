import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RouteErrorPage, getRouteErrorRecoveryAction } from "@/app/error";
import { NotFoundPage } from "@/app/not-found";

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");

  return {
    Link: React.forwardRef<
      HTMLAnchorElement,
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
    >(({ to, ...props }, ref) => React.createElement("a", { ...props, href: to, ref })),
  };
});

describe("RouteErrorPage", () => {
  test("retries the failed route through the router reset callback", () => {
    const reset = vi.fn();

    render(<RouteErrorPage error={new Error("Route failed")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
  });

  test("sends the exact session-load failure to login", () => {
    const action = getRouteErrorRecoveryAction(new Error("Unable to load your session."));

    expect(action).toEqual({ label: "Go to login", to: "/" });

    render(<RouteErrorPage error={new Error("Unable to load your session.")} reset={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Go to login" }).getAttribute("href")).toBe("/");
  });

  test("sends other route failures home", () => {
    const action = getRouteErrorRecoveryAction(new Error("Feed failed"));

    expect(action).toEqual({ label: "Go home", to: "/" });
  });
});

describe("NotFoundPage", () => {
  test("sends users home instead of entering the protected inbox", () => {
    render(<NotFoundPage />);

    expect(screen.getByRole("link", { name: "Go home" }).getAttribute("href")).toBe("/");
  });
});
