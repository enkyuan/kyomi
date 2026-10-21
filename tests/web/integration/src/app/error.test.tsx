import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DefaultErrorPage, RouteErrorPage } from "@/app/error";
import { DefaultNotFoundPage, NotFoundPage } from "@/app/not-found";
import { HttpStatusError } from "@lib/status";
import {
  getAuthRecoveryAction,
  getPathRecoveryAction,
  INBOX_RECOVERY_ACTION,
  LOGIN_RECOVERY_ACTION,
} from "@/lib/recovery";

const mocks = vi.hoisted(() => ({
  authState: undefined as { status: "authenticated" | "anonymous" } | undefined,
  invalidate: vi.fn(),
  matchIds: [] as string[],
  pathname: "/inbox/item-1",
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");

  return {
    Link: React.forwardRef<
      HTMLAnchorElement,
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
    >(({ to, ...props }, ref) => React.createElement("a", { ...props, href: to, ref })),
    useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
      select({ pathname: mocks.pathname }),
    useMatches: ({ select }: { select: (matches: { routeId: string }[]) => unknown }) =>
      select(mocks.matchIds.map((routeId) => ({ routeId }))),
    useRouteContext: ({ select }: { select: (context: unknown) => unknown }) =>
      select(mocks.authState ? { authState: mocks.authState } : undefined),
    useRouter: () => ({
      invalidate: mocks.invalidate,
      state: { location: { pathname: mocks.pathname } },
    }),
  };
});

beforeEach(() => {
  mocks.invalidate.mockReset();
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.pathname = "/inbox/item-1";
  mocks.authState = undefined;
  mocks.matchIds = [];
});

describe("RouteErrorPage", () => {
  test.each([
    [INBOX_RECOVERY_ACTION, "Back to inbox", "/inbox"],
    [LOGIN_RECOVERY_ACTION, "Go to login", "/"],
  ] as const)("offers only the contextual recovery action (%#)", (recoveryAction, label, href) => {
    render(
      <RouteErrorPage
        error={new Error("Feed failed")}
        reset={vi.fn()}
        recoveryAction={recoveryAction}
      />,
    );

    const action = screen.getByRole("link", { name: label });
    expect(action.getAttribute("href")).toBe(href);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  test("recovers in place when the failed page is the recovery target", async () => {
    const reset = vi.fn();
    mocks.pathname = "/inbox";

    render(
      <RouteErrorPage
        error={new Error("Feed failed")}
        recoveryAction={INBOX_RECOVERY_ACTION}
        reset={reset}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "Back to inbox" }));

    expect(mocks.invalidate).toHaveBeenCalledOnce();
    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
  });

  test("navigates normally when the failed page is elsewhere", () => {
    const reset = vi.fn();

    render(
      <RouteErrorPage
        error={new Error("Feed failed")}
        recoveryAction={INBOX_RECOVERY_ACTION}
        reset={reset}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "Back to inbox" }));

    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  test("drops the retry hint the page cannot act on", () => {
    render(
      <RouteErrorPage
        error={new Error("Unable to load your session. Try again.")}
        recoveryAction={LOGIN_RECOVERY_ACTION}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByText("Unable to load your session.")).toBeTruthy();
    expect(screen.queryByText(/try again/i)).toBeNull();
  });

  test("styles the recovery action as the primary button", () => {
    render(
      <RouteErrorPage
        error={new Error("Feed failed")}
        recoveryAction={INBOX_RECOVERY_ACTION}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Back to inbox" }).className).toContain("bg-primary");
  });
});

describe("RouteErrorPage status copy", () => {
  function renderStatus(error: unknown) {
    return render(
      <RouteErrorPage
        error={error as Error}
        reset={vi.fn()}
        recoveryAction={INBOX_RECOVERY_ACTION}
      />,
    );
  }

  test.each([
    [401, "Session ended"],
    [403, "No entry"],
    [429, "Easy there"],
    [502, "We lost the plot"],
    [503, "We lost the plot"],
    [504, "We lost the plot"],
  ] as const)("shows fixed copy for a %i", (status, title) => {
    renderStatus(new HttpStatusError(status, "Internal detail from the server"));

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByText(/internal detail/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to inbox" })).toBeTruthy();
  });

  test.each([
    ["a status error", new HttpStatusError(404, "That item could not be found.")],
    ["a thrown response", new Response(null, { status: 404 })],
    ["a router not-found", { isNotFound: true }],
  ])("renders the not-found page for %s", (_name, error) => {
    renderStatus(error);

    expect(screen.getByText("Page not found")).toBeTruthy();
    expect(screen.queryByText("We lost the plot")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to inbox" })).toBeTruthy();
  });

  test("keeps the safe message for statuses without their own copy", () => {
    renderStatus(new HttpStatusError(409, "That change conflicts with the current state."));

    expect(screen.getByText("We lost the plot")).toBeTruthy();
    expect(screen.getByText("That change conflicts with the current state.")).toBeTruthy();
  });

  test("keeps the not-found page in the shell too", () => {
    mocks.matchIds = ["__root__", "/_app"];
    mocks.authState = { status: "authenticated" };

    render(<DefaultErrorPage error={new HttpStatusError(404)} reset={vi.fn()} />);

    expect(screen.getByText("Page not found")).toBeTruthy();
    expect(screen.queryByRole("main")).toBeNull();
  });
});

describe("error page context", () => {
  const defaultErrorProps = { error: new Error("Feed failed"), reset: vi.fn() };

  test("keeps the app shell for failures under it", () => {
    mocks.matchIds = ["__root__", "/_app", "/_app/inbox"];
    mocks.authState = { status: "authenticated" };

    render(<DefaultErrorPage {...defaultErrorProps} />);

    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to inbox" }).getAttribute("href")).toBe("/inbox");
  });

  test("takes over the page outside the shell", () => {
    mocks.matchIds = ["__root__", "/"];
    mocks.pathname = "/";
    mocks.authState = { status: "anonymous" };

    render(<DefaultErrorPage {...defaultErrorProps} />);

    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to login" }).getAttribute("href")).toBe("/");
  });

  test("follows the failing area when the session lookup itself failed", () => {
    mocks.matchIds = ["__root__"];
    mocks.pathname = "/inbox/some-article";

    render(<DefaultErrorPage {...defaultErrorProps} />);

    expect(screen.getByRole("link", { name: "Back to inbox" }).getAttribute("href")).toBe("/inbox");
  });

  test("never shows a raw server message", () => {
    render(
      <RouteErrorPage
        error={new Error("HTTP 500 at https://internal.example/api/feeds")}
        recoveryAction={INBOX_RECOVERY_ACTION}
        reset={vi.fn()}
      />,
    );

    expect(screen.queryByText(/internal\.example/)).toBeNull();
    expect(screen.getByText("The page lost its place for a moment.")).toBeTruthy();
  });

  test("renders the not-found page in the shell too", () => {
    mocks.matchIds = ["__root__", "/_app"];
    mocks.authState = { status: "authenticated" };

    render(<DefaultNotFoundPage />);

    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to inbox" })).toBeTruthy();
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

  test("falls back to the failing area when authentication is unknown", () => {
    expect(getPathRecoveryAction("/inbox")).toBe(INBOX_RECOVERY_ACTION);
    expect(getPathRecoveryAction("/inbox/some-article")).toBe(INBOX_RECOVERY_ACTION);
    expect(getPathRecoveryAction("/")).toBe(LOGIN_RECOVERY_ACTION);
    expect(getPathRecoveryAction("/register")).toBe(LOGIN_RECOVERY_ACTION);
    expect(getPathRecoveryAction("/inboxes")).toBe(LOGIN_RECOVERY_ACTION);
  });
});
