/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-doctor/only-export-components */
/* eslint-disable react-doctor/no-danger */
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Agentation } from "agentation";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import interLatinWoff2Url from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import AuthProvider from "@integrations/better-auth/provider";
import TanstackQueryProvider from "@integrations/tanstack-query/provider";
import { RouteErrorPage } from "@/app/error";
import { AppRuntimeEffects } from "@/app/runtime-effects";
import { NotFoundPage } from "@/app/not-found";
import { getAuthRecoveryAction, LOGIN_RECOVERY_ACTION } from "@/app/recovery";
import { AnchoredToastProvider, ToastProvider } from "@kyomi/ui/toast";
import PostHogProvider from "@integrations/posthog/provider";
import { getAuthBootstrapState } from "@lib/auth/functions";
import type { AuthCapabilities } from "@lib/auth/capabilities";
import type { AvailableAuthSessionState } from "@lib/auth/session";
import {
  INBOX_PREFERENCES_STORAGE_KEY,
  READER_PREFERENCES_STORAGE_KEY,
  SHELL_STATE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@lib/shell/keys";
import { INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME } from "@modules/inbox/lib/layout/persistence";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
}

type RootLoaderData = {
  authState: AvailableAuthSessionState;
  authCapabilities: AuthCapabilities;
};

const SHELL_INIT_SCRIPT = `(function(){try{var root=document.documentElement;function readJson(key){try{var raw=window.localStorage.getItem(key);return raw?JSON.parse(raw):null}catch(e){return null}}function readCookie(name){var prefix=name+'=';var parts=document.cookie?document.cookie.split(';'):[];for(var i=0;i<parts.length;i++){var part=parts[i].trim();if(part.indexOf(prefix)===0)return decodeURIComponent(part.slice(prefix.length))}return null}var stored=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'dark';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;var reader=readJson(${JSON.stringify(READER_PREFERENCES_STORAGE_KEY)})||{};if(typeof reader.fontSizePx==='number')root.style.setProperty('--reader-font-size',Math.round(reader.fontSizePx)+'px');if(reader.contentWidth==='narrow'||reader.contentWidth==='wide')root.dataset.readerContentWidth=reader.contentWidth;var inbox=readJson(${JSON.stringify(INBOX_PREFERENCES_STORAGE_KEY)})||{};if(typeof inbox.inboxFontSizePx==='number')root.style.setProperty('--inbox-font-size',Math.round(inbox.inboxFontSizePx)+'px');if(inbox.inboxDensity==='compact'||inbox.inboxDensity==='comfortable')root.dataset.inboxDensity=inbox.inboxDensity;if(inbox.articleOpenBehavior==='split'||inbox.articleOpenBehavior==='reader')root.dataset.inboxArticleOpenBehavior=inbox.articleOpenBehavior;var articleOpenBehavior=readCookie(${JSON.stringify(INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME)});if(articleOpenBehavior==='split'||articleOpenBehavior==='reader')root.dataset.inboxArticleOpenBehavior=articleOpenBehavior;var sidebarOpen=readCookie('sidebar_state');if(sidebarOpen==='true'||sidebarOpen==='false')root.dataset.sidebarState=sidebarOpen==='true'?'expanded':'collapsed';var shell=readJson(${JSON.stringify(SHELL_STATE_STORAGE_KEY)})||{};if(typeof shell.inboxFilter==='string')root.dataset.inboxFilter=shell.inboxFilter;if(typeof shell.inboxLayout==='string')root.dataset.inboxLayout=shell.inboxLayout;if(typeof shell.selectedItemId==='string')root.dataset.selectedItemId=shell.selectedItemId;}catch(e){console.warn('shell init failed',e);}})();`;
const REACT_SCAN_STORAGE_KEY = "kyomi:dev:react-scan";
const REACT_SCAN_QUERY_PARAM = "react-scan";

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    const { authState, authCapabilities } = await getAuthBootstrapState();
    if (authState.status === "unavailable") {
      throw new Error(authState.message);
    }
    return { authState, authCapabilities };
  },
  loader: ({ context }) => ({
    authState: context.authState,
    authCapabilities: context.authCapabilities,
  }),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Kyomi",
      },
      {
        name: "apple-mobile-web-app-title",
        content: "Kyomi",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preload",
        href: interLatinWoff2Url,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "96x96",
        href: "/favicon/favicon-96x96.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "196x196",
        href: "/favicon/favicon-196x196.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/favicon/apple-touch-icon-180x180.png",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
  errorComponent: RootRouteErrorPage,
  notFoundComponent: RootNotFoundPage,
});

function RootRouteErrorPage(props: ErrorComponentProps) {
  return <RouteErrorPage {...props} />;
}

function RootNotFoundPage() {
  const loaderData = Route.useLoaderData() as RootLoaderData;
  return (
    <NotFoundPage
      recoveryAction={getAuthRecoveryAction(loaderData.authState) ?? LOGIN_RECOVERY_ACTION}
    />
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const loaderData = Route.useLoaderData() as RootLoaderData | undefined;
  const initialSession =
    loaderData?.authState.status === "authenticated" ? loaderData.authState.session : null;

  useEffect(() => {
    if (import.meta.env.DEV) {
      void import("react-grab");
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const queryValue = searchParams.get(REACT_SCAN_QUERY_PARAM);

    if (queryValue === "1") {
      window.localStorage.setItem(REACT_SCAN_STORAGE_KEY, "1");
    } else if (queryValue === "0") {
      window.localStorage.removeItem(REACT_SCAN_STORAGE_KEY);
    }

    if (window.localStorage.getItem(REACT_SCAN_STORAGE_KEY) !== "1") {
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-kyomi-react-scan="true"]',
    );
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.crossOrigin = "anonymous";
    script.dataset.kyomiReactScan = "true";
    script.src = "https://unpkg.com/react-scan/dist/auto.global.js";
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Inline shell init must be its own script: if `src` is set, browsers ignore inline body. */}
        {/* eslint-disable-next-line react-doctor/no-danger */}
        {/* oxlint-disable-next-line react/no-danger -- static first-paint shell bootstrap; not user HTML */}
        <script dangerouslySetInnerHTML={{ __html: SHELL_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased wrap-anywhere selection:bg-matcha/24">
        <PostHogProvider>
          <ToastProvider>
            <AnchoredToastProvider>
              <TanstackQueryProvider sessionStatus={loaderData?.authState.status}>
                <AuthProvider initialSession={initialSession}>
                  <AppRuntimeEffects />
                  {children}
                </AuthProvider>
              </TanstackQueryProvider>
            </AnchoredToastProvider>
          </ToastProvider>
        </PostHogProvider>
        {import.meta.env.DEV ? <Agentation /> : null}
        <Scripts />
      </body>
    </html>
  );
}
