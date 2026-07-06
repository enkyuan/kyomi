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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@kyomi/ui/breadcrumb";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from "@kyomi/ui/sidebar";
import { Separator } from "@kyomi/ui/separator";
import { AccountPageNav, AccountPagePanel, accountSection } from "../account";
import { AdvancedPageNav, AdvancedPagePanel, advancedSection } from "../advanced";
import { AppearancePageNav, AppearancePagePanel, appearanceSection } from "../appearance";
import { BillingPageNav, BillingPagePanel, billingSection } from "../billing";
import { FeedbackPageNav, FeedbackPagePanel, feedbackSection } from "../feedback";
import {
  PersonalizationPageNav,
  PersonalizationPagePanel,
  personalizationSection,
} from "../personalization";

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

function SettingsDialogRouteLayout() {
  const pathname = useRouterState({
    router: settingsRouter,
    select: (state) => state.location.pathname,
  });
  const accountMatch = pathname === "/account";
  const appearanceMatch = pathname === "/appearance";
  const personalizationMatch = pathname === "/personalization";
  const billingMatch = pathname === "/billing";
  const feedbackMatch = pathname === "/feedback";
  const advancedMatch = pathname === "/advanced";
  const activeSectionName =
    (accountMatch && accountSection.name) ||
    (appearanceMatch && appearanceSection.name) ||
    (personalizationMatch && personalizationSection.name) ||
    (billingMatch && billingSection.name) ||
    (feedbackMatch && feedbackSection.name) ||
    (advancedMatch && advancedSection.name) ||
    accountSection.name;

  return (
    <SidebarProvider className="h-full items-start bg-popover">
      <Sidebar
        collapsible="none"
        className="hidden h-full w-48 border-r border-border bg-sidebar md:flex"
      >
        <SidebarContent className="gap-0">
          <SidebarGroup className="p-3">
            <SidebarGroupContent>
              <SidebarMenu>
                <AccountPageNav
                  isActive={accountMatch}
                  onSelect={() => navigateToSettingsRoute("/account")}
                />
                <AppearancePageNav
                  isActive={appearanceMatch}
                  onSelect={() => navigateToSettingsRoute("/appearance")}
                />
                <PersonalizationPageNav
                  isActive={personalizationMatch}
                  onSelect={() => navigateToSettingsRoute("/personalization")}
                />
                <BillingPageNav
                  isActive={billingMatch}
                  onSelect={() => navigateToSettingsRoute("/billing")}
                />
                <FeedbackPageNav
                  isActive={feedbackMatch}
                  onSelect={() => navigateToSettingsRoute("/feedback")}
                />
                <AdvancedPageNav
                  isActive={advancedMatch}
                  onSelect={() => navigateToSettingsRoute("/advanced")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex h-135 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center ps-5 pe-14">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Settings</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeSectionName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <Separator />
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
