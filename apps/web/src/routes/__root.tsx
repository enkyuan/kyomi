/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-doctor/only-export-components */
/* eslint-disable react-doctor/no-danger */
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { Agentation } from "agentation";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import interLatinWoff2Url from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import AuthProvider from "@integrations/better-auth/provider";
import TanstackQueryProvider from "@integrations/tanstack-query/provider";
import { AppRuntimeEffects } from "@/app/runtime-effects";
import { AnchoredToastProvider, ToastProvider } from "@kyomi/ui/toast";
import PostHogProvider from "@integrations/posthog/provider";
import { getSession } from "@lib/auth/functions";
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

const SHELL_INIT_SCRIPT = `(function(){try{var root=document.documentElement;function readJson(key){try{var raw=window.localStorage.getItem(key);return raw?JSON.parse(raw):null}catch(e){return null}}function readCookie(name){var prefix=name+'=';var parts=document.cookie?document.cookie.split(';'):[];for(var i=0;i<parts.length;i++){var part=parts[i].trim();if(part.indexOf(prefix)===0)return decodeURIComponent(part.slice(prefix.length))}return null}var stored=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'dark';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;var reader=readJson(${JSON.stringify(READER_PREFERENCES_STORAGE_KEY)})||{};if(typeof reader.fontSizePx==='number')root.style.setProperty('--reader-font-size',Math.round(reader.fontSizePx)+'px');if(reader.contentWidth==='narrow'||reader.contentWidth==='wide')root.dataset.readerContentWidth=reader.contentWidth;var inbox=readJson(${JSON.stringify(INBOX_PREFERENCES_STORAGE_KEY)})||{};if(typeof inbox.inboxFontSizePx==='number')root.style.setProperty('--inbox-font-size',Math.round(inbox.inboxFontSizePx)+'px');if(inbox.inboxDensity==='compact'||inbox.inboxDensity==='comfortable')root.dataset.inboxDensity=inbox.inboxDensity;if(inbox.articleOpenBehavior==='split'||inbox.articleOpenBehavior==='reader')root.dataset.inboxArticleOpenBehavior=inbox.articleOpenBehavior;var articleOpenBehavior=readCookie(${JSON.stringify(INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME)});if(articleOpenBehavior==='split'||articleOpenBehavior==='reader')root.dataset.inboxArticleOpenBehavior=articleOpenBehavior;var sidebarOpen=readCookie('sidebar_state');if(sidebarOpen==='true'||sidebarOpen==='false')root.dataset.sidebarState=sidebarOpen==='true'?'expanded':'collapsed';var shell=readJson(${JSON.stringify(SHELL_STATE_STORAGE_KEY)})||{};if(typeof shell.inboxFilter==='string')root.dataset.inboxFilter=shell.inboxFilter;if(typeof shell.inboxLayout==='string')root.dataset.inboxLayout=shell.inboxLayout;if(typeof shell.selectedItemId==='string')root.dataset.selectedItemId=shell.selectedItemId;}catch(e){console.warn('shell init failed',e);}})();`;
const REACT_SCAN_STORAGE_KEY = "kyomi:dev:react-scan";
const REACT_SCAN_QUERY_PARAM = "react-scan";

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: async () => {
    // Canonical session hydration source for route tree/bootstrap render.
    const initialSession = await getSession();
    return { initialSession };
  },
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
        href: "/favicon/favicon.ico",
        sizes: "any",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon/favicon.svg",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "96x96",
        href: "/favicon/favicon-96x96.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/favicon/apple-touch-icon.png",
      },
      {
        rel: "manifest",
        href: "/favicon/site.webmanifest",
      },
    ],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-center text-foreground">
      <div className="max-w-sm space-y-2">
        <h1 className="font-heading font-semibold text-2xl">Not found</h1>
        <p className="text-muted-foreground text-sm">This page does not exist or has moved.</p>
      </div>
    </main>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const loaderData = Route.useLoaderData() as
    | { initialSession?: Awaited<ReturnType<typeof getSession>> }
    | undefined;
  const initialSession = loaderData?.initialSession ?? null;

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
      <body className="min-h-screen bg-background font-sans text-foreground antialiased wrap-anywhere selection:bg-[rgba(79,184,178,0.24)]">
        <PostHogProvider>
          <ToastProvider>
            <AnchoredToastProvider>
              <TanstackQueryProvider>
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
