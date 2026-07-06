"use client";

import { use } from "react";
import * as React from "react";
import { useMediaQuery } from "../../hooks/use-media-query";
import { cn } from "../../lib/utils";

const SIDEBAR_COOKIE_NAME: string = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE: number = 60 * 60 * 24 * 7;
const SIDEBAR_KEYBOARD_SHORTCUT: string = "b";

export const SIDEBAR_WIDTH: string = "16rem";
export const SIDEBAR_WIDTH_MOBILE: string = "18rem";
export const SIDEBAR_WIDTH_ICON: string = "3rem";

function readSidebarOpenCookie(): boolean | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const entry = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`));

  if (!entry) {
    return undefined;
  }

  return entry.slice(`${SIDEBAR_COOKIE_NAME}=`.length) === "true";
}

export type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

export const SidebarContext: React.Context<SidebarContextProps | null> =
  React.createContext<SidebarContextProps | null>(null);

export function useSidebar(): SidebarContextProps {
  const context = use(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}): React.ReactElement {
  const isMobile = useMediaQuery("max-md");
  const [openMobile, setOpenMobile] = React.useState(false);

  // Uncontrolled open state: lazy-init from cookie, then defaultOpen (not `useState(defaultOpen)`).
  const [_open, _setOpen] = React.useState(() => readSidebarOpenCookie() ?? defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      if (typeof document !== "undefined") {
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${String(openState)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      }
    },
    [setOpenProp, open],
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      isMobile,
      open,
      openMobile,
      setOpen,
      setOpenMobile,
      state,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
          className,
        )}
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}
