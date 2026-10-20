import { render, screen } from "@testing-library/react";
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

function renderApp(path: string, { failLoader = false }: { failLoader?: boolean } = {}) {
  const root = createRootRoute({
    beforeLoad: () => ({ authState: { status: "authenticated" } }),
    component: () => <Outlet />,
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
      if (failLoader) throw new Error("Feed failed");
    },
    component: () => <p>Inbox content</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([shell.addChildren([inbox])]),
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

  test("an unknown path under the shell renders not-found inside it", async () => {
    renderApp("/inbox/missing/extra");

    expect(await screen.findByText("Page not found")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "sidebar" })).toBeTruthy();
  });
});
