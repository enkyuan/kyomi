"use client";

import { createContext, use, useMemo } from "react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRootRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { ScrollArea } from "@kyomi/ui/components/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from "@kyomi/ui/components/sidebar";
import { AccountPageNav, AccountPagePanel } from "../account";
import { AdvancedPageNav, AdvancedPagePanel } from "../advanced";
import { AppearancePageNav, AppearancePagePanel } from "../appearance";
import { BillingPageNav, BillingPagePanel } from "../billing";
import { FeedbackPageNav, FeedbackPagePanel } from "../feedback";
import { PersonalizationPageNav, PersonalizationPagePanel } from "../personalization";

type SettingsDialogRouteContextValue = {
  logout: () => Promise<void>;
};

const SettingsDialogRouteContext = createContext<SettingsDialogRouteContextValue | null>(null);

function useSettingsDialogRouteContext() {
  const value = use(SettingsDialogRouteContext);

  if (!value) {
    throw new Error("Settings dialog routes must be rendered inside SettingsDialogRoutes.");
  }

  return value;
}

function navigateToSettingsRoute(to: SettingsRoutePath) {
  void settingsRouter.navigate({ to: to as never });
}

function SettingsSectionMenu({ pathname, className }: { pathname: string; className?: string }) {
  return (
    <SidebarMenu className={className}>
      <AccountPageNav
        isActive={pathname === "/account"}
        onSelect={() => navigateToSettingsRoute("/account")}
      />
      <AppearancePageNav
        isActive={pathname === "/appearance"}
        onSelect={() => navigateToSettingsRoute("/appearance")}
      />
      <PersonalizationPageNav
        isActive={pathname === "/personalization"}
        onSelect={() => navigateToSettingsRoute("/personalization")}
      />
      <BillingPageNav
        isActive={pathname === "/billing"}
        onSelect={() => navigateToSettingsRoute("/billing")}
      />
      <FeedbackPageNav
        isActive={pathname === "/feedback"}
        onSelect={() => navigateToSettingsRoute("/feedback")}
      />
      <AdvancedPageNav
        isActive={pathname === "/advanced"}
        onSelect={() => navigateToSettingsRoute("/advanced")}
      />
    </SidebarMenu>
  );
}

function SettingsDialogRouteLayout() {
  const pathname = useRouterState({
    router: settingsRouter,
    select: (state) => state.location.pathname,
  });

  return (
    <SidebarProvider className="h-full items-start bg-popover">
      <Sidebar
        collapsible="none"
        className="hidden h-full w-48 border-r border-border bg-sidebar md:flex"
      >
        <SidebarContent className="gap-0">
          <SidebarGroup className="p-3">
            <SidebarGroupContent>
              <SettingsSectionMenu pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <nav aria-label="Settings sections" className="border-b border-border p-2 md:hidden">
          <SettingsSectionMenu
            pathname={pathname}
            className="flex-row overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>[data-slot=sidebar-menu-item]]:shrink-0 [&_[data-slot=sidebar-menu-button]]:w-auto"
          />
        </nav>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-5">
            <Outlet />
          </div>
        </ScrollArea>
      </main>
    </SidebarProvider>
  );
}

function AccountSettingsRoute() {
  const { logout } = useSettingsDialogRouteContext();

  return <AccountPagePanel onLogout={logout} />;
}

const rootRoute = createRootRoute({
  component: SettingsDialogRouteLayout,
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountSettingsRoute,
});

const appearanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/appearance",
  component: AppearancePagePanel,
});

const personalizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/personalization",
  component: PersonalizationPagePanel,
});

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/billing",
  component: BillingPagePanel,
});

const feedbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feedback",
  component: FeedbackPagePanel,
});

const advancedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/advanced",
  component: AdvancedPagePanel,
});

const routeTree = rootRoute.addChildren([
  accountRoute,
  appearanceRoute,
  personalizationRoute,
  billingRoute,
  feedbackRoute,
  advancedRoute,
]);

const settingsRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/account"] }),
});

type SettingsRoutePath =
  | "/account"
  | "/appearance"
  | "/personalization"
  | "/billing"
  | "/feedback"
  | "/advanced";

type SettingsDialogRoutesProps = {
  logout: () => Promise<void>;
};

export function SettingsDialogRoutes({ logout }: SettingsDialogRoutesProps) {
  const routeContextValue = useMemo(() => ({ logout }), [logout]);

  return (
    <SettingsDialogRouteContext.Provider value={routeContextValue}>
      <RouterProvider router={settingsRouter} />
    </SettingsDialogRouteContext.Provider>
  );
}
