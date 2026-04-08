import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { Agentation } from "agentation";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import AuthProvider from "@integrations/better-auth/auth-provider";
import TanstackQueryProvider from "@integrations/tanstack-query/root-provider";
import { AnchoredToastProvider, ToastProvider } from "@components/ui/toast";
import PostHogProvider from "@integrations/posthog/provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'dark';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
        title: "Cronos",
      },
      {
        name: "apple-mobile-web-app-title",
        content: "Cronos",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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
});

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (import.meta.env.DEV) {
      void import("react-grab");
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased wrap-anywhere selection:bg-[rgba(79,184,178,0.24)]">
        <PostHogProvider>
          <ToastProvider>
            <AnchoredToastProvider>
              <TanstackQueryProvider>
                <AuthProvider>{children}</AuthProvider>
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
