// Value: protects=real-router error and not-found pages: a failing content route keeps the shell, a failing session lookup at the root renders a full page, and each offers one path-based recovery action;
//   fails_when=the layout is chosen from the matched URL instead of the route that owns the boundary, the router defaults are unwired, or the recovery action stops following the failing area;
//   why_new=error.test.tsx hand-mocks the router hooks, which hid a shell-less panel when the root beforeLoad failed;
//   seam=none; no_claim=the production route tree (a small stand-in tree is used) and SSR output.
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, test, vi } from "vitest";
import { DefaultErrorPage } from "@/app/error";
import { DefaultNotFoundPage } from "@/app/not-found";

function renderApp(
  path: string,
  {
    failLoader = false,
    failLoaderOnce = false,
    failRoot = false,
  }: { failLoader?: boolean; failLoaderOnce?: boolean; failRoot?: boolean } = {},
) {
  let loaderCalls = 0;
  const root = createRootRoute({
    beforeLoad: () => {
      if (failRoot) throw new Error("Unable to load your session. Try again.");
      return { authState: { status: "authenticated" } };
    },
    component: () => <Outlet />,
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <p>Login</p>,
  });
  const shell = createRoute({
    getParentRoute: () => root,
    id: "/_app",
    component: () => (
      <div>
        <nav aria-label="sidebar" />
        <Outlet />
      </div>
    ),
  });
  const inbox = createRoute({
    getParentRoute: () => shell,
    path: "/inbox",
    loader: () => {
      loaderCalls += 1;
      if (failLoader || (failLoaderOnce && loaderCalls === 1)) throw new Error("Feed failed");
    },
    component: () => <p>Inbox content</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([home, shell.addChildren([inbox])]),
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultErrorComponent: DefaultErrorPage,
    defaultNotFoundComponent: DefaultNotFoundPage,
  });

  return render(<RouterProvider router={router} />);
}

describe("router-wide error pages", () => {
  test("a failing content route keeps the app shell and offers the inbox", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderApp("/inbox", { failLoader: true });

    expect(await screen.findByRole("link", { name: "Back to inbox" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "sidebar" })).toBeTruthy();
    expect(screen.queryByRole("main")).toBeNull();
  });

  test("the recovery link on the failed page retries in place and restores the content", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderApp("/inbox", { failLoaderOnce: true });
    fireEvent.click(await screen.findByRole("link", { name: "Back to inbox" }));

    expect(await screen.findByText("Inbox content")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "sidebar" })).toBeTruthy();
    expect(screen.queryByText("We lost the plot")).toBeNull();
  });

  test("a failed session lookup at the root is a full page even though /_app matched the URL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderApp("/inbox", { failRoot: true });

    expect(await screen.findByRole("link", { name: "Back to inbox" })).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "sidebar" })).toBeNull();
    expect(screen.getByText("Unable to load your session.")).toBeTruthy();
  });

  test("a failed session lookup outside the signed-in area offers the login page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderApp("/", { failRoot: true });

    expect(await screen.findByRole("link", { name: "Go to login" })).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
  });

  test("an unknown path under the shell renders not-found inside it", async () => {
    renderApp("/inbox/missing/extra");

    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "sidebar" })).toBeTruthy();
  });
});
