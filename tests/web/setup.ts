// jsdom has no Web Animations, layout observers, or media queries; Torph (TextMorph) reads them when it
// attaches.
// Tests that assert on animation behaviour install their own spies over these.
if (typeof Element !== "undefined") {
  Element.prototype.getAnimations ??= () => [];
  Element.prototype.animate ??= (() => ({
    cancel() {},
    finished: Promise.resolve(),
    onfinish: null,
  })) as unknown as Element["animate"];
}

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (typeof window !== "undefined") {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
