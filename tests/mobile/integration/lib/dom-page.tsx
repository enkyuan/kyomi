import { JSDOM, VirtualConsole } from "jsdom";
import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const GLOBAL_KEYS = [
  "AbortController",
  "AbortSignal",
  "window",
  "document",
  "navigator",
  "DOMParser",
  "Document",
  "DocumentFragment",
  "Element",
  "HTMLElement",
  "MouseEvent",
  "Node",
  "NodeFilter",
] as const;

type GlobalKey = (typeof GLOBAL_KEYS)[number];

/**
 * A browser page for the Expo DOM components, which run inside a WebView. `navigations()` reports
 * every page load the page attempted: jsdom reports them instead of performing them, so a link
 * the component left alone shows up there, the way it would load inside the WebView.
 */
export function createDomPage({ localStorage }: { localStorage?: Storage | object } = {}) {
  const navigations: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    if (error.message.includes("navigation")) navigations.push(error.message);
  });
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    pretendToBeVisual: true,
    url: "file:///dom/article.html",
    virtualConsole,
  });
  // jsdom refuses its own localStorage on a file: page; a test that needs the app's store supplies one.
  if (localStorage) {
    Object.defineProperty(dom.window, "localStorage", { configurable: true, value: localStorage });
  }
  const saved = new Map<GlobalKey, PropertyDescriptor | undefined>();
  let root: Root | undefined;

  return {
    /**
     * The page loads attempted so far. jsdom starts the load for a followed link on a zero-delay
     * timer of its own window, after the click has returned, so this waits a turn of that timer
     * queue first: a synchronous read sees nothing whether or not the link navigated.
     */
    async navigations() {
      await new Promise<void>((resolve) => dom.window.setTimeout(resolve, 20));
      return [...navigations];
    },
    /** Installs the page as the global browser, mounts `element`, and waits for effects. */
    async mount(element: ReactElement) {
      for (const key of GLOBAL_KEYS) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {
          configurable: true,
          value: (dom.window as unknown as Record<string, unknown>)[key],
          writable: true,
        });
      }
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      const container = dom.window.document.getElementById("root") as HTMLElement;
      root = createRoot(container);
      await act(async () => root?.render(element));
      return container;
    },
    /** Renders `element` into the mounted page again, keeping the state of what is already there. */
    async render(element: ReactElement) {
      await act(async () => root?.render(element));
    },
    /** A tap on `target`: a cancelable click that bubbles, as the WebView delivers it. */
    click(target: Element) {
      const event = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    },
    async cleanup() {
      await act(async () => root?.unmount());
      for (const key of GLOBAL_KEYS) {
        const descriptor = saved.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
      dom.window.close();
    },
  };
}
