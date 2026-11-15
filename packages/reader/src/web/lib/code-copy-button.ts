const COPY_MOUNTED = "data-reader-copy-mounted";
const BUTTON_ICON_SIZE = 12;
const BUTTON_ICON_PADDING = 16;

type IconShape = {
  readonly tag: "path";
  readonly attrs: Readonly<Record<string, string>>;
};

// Blode Icons (MIT) `FilesFilledIcon` and `Checkmark1Icon` geometry on a 24px grid. The native
// reader draws the same two glyphs (`native/document/icons.tsx`), so keep them in step.
const COPY_ICON_SHAPES: readonly IconShape[] = [
  {
    tag: "path",
    attrs: {
      "clip-rule": "evenodd",
      d: "M17.8986 18.8987C17.4908 20.6751 15.9002 22 14 22H8c-2.2091 0-4-1.7909-4-4V9c0-1.9001 1.325-3.4908 3.1014-3.8986C7.5092 3.3249 9.0999 2 11 2h3v4c0 1.6569 1.3431 3 3 3h4v6c0 1.9002-1.3249 3.4909-3.1014 3.8987M7 7.2676C6.4022 7.6134 6 8.2597 6 9v9c0 1.1046.8954 2 2 2h6c.7403 0 1.3866-.4022 1.7324-1H11c-2.2091 0-4-1.7909-4-4z",
      "fill-rule": "evenodd",
    },
  },
  { tag: "path", attrs: { d: "M16 2.5858 20.4142 7H17c-.5523 0-1-.4477-1-1z" } },
];
/** A line glyph: stroked, not filled, as Blode draws it. */
const CHECK_ICON_SHAPES: readonly IconShape[] = [
  {
    tag: "path",
    attrs: {
      d: "M5 12.75 10 19l9-14",
      fill: "none",
      stroke: "currentColor",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-width": "2",
    },
  },
];

function makeSvgIcon(shapes: readonly IconShape[]): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(BUTTON_ICON_SIZE));
  svg.setAttribute("height", String(BUTTON_ICON_SIZE));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "currentColor");
  for (const { tag, attrs } of shapes) {
    const shape = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attrs)) {
      shape.setAttribute(name, value);
    }
    svg.appendChild(shape);
  }
  return svg;
}

export function mountCopyButton(host: HTMLElement, text: string): void {
  if (host.getAttribute(COPY_MOUNTED) === "true") {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "reader-code-copy-button";
  button.setAttribute("aria-label", "Copy code");
  button.style.setProperty("--rcb-icon-size", `${BUTTON_ICON_SIZE}px`);
  button.style.setProperty("--rcb-button-size", `${BUTTON_ICON_SIZE + BUTTON_ICON_PADDING}px`);

  const copyIcon = makeSvgIcon(COPY_ICON_SHAPES);
  copyIcon.setAttribute("class", "rcb-icon rcb-icon-copy");

  const checkIcon = makeSvgIcon(CHECK_ICON_SHAPES);
  checkIcon.setAttribute("class", "rcb-icon rcb-icon-check");

  button.appendChild(copyIcon);
  button.appendChild(checkIcon);

  let resetCopyStateTimer: number | null = null;

  button.addEventListener("click", () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (resetCopyStateTimer !== null) {
          window.clearTimeout(resetCopyStateTimer);
        }

        button.classList.add("is-copied");
        button.setAttribute("aria-label", "Copied");

        resetCopyStateTimer = window.setTimeout(() => {
          button.classList.remove("is-copied");
          button.setAttribute("aria-label", "Copy code");
          resetCopyStateTimer = null;
        }, 2000);
      })
      .catch(() => {
        /* clipboard unavailable — silently ignore */
      });
  });

  host.appendChild(button);
  host.setAttribute(COPY_MOUNTED, "true");
}

export function unmountCopyButton(host: HTMLElement): void {
  host.replaceChildren();
  host.removeAttribute(COPY_MOUNTED);
}
