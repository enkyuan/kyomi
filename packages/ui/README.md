# @kyomi/ui

Kyomi's design system: Base UI primitives styled with Tailwind v4, semantic tokens, icons, and
motion. The layout follows the shadcn monorepo template and cal.com's `@coss/ui`, so registry
components (`bunx shadcn add @coss/<name>`, see `components.json`) land where the rest live.

```text
components.json            shadcn CLI config: installs land in src/components
src/
  components/<name>.tsx    One primitive per file          @kyomi/ui/components/<name>
  components/<name>/       Multi-file primitive (index.tsx) @kyomi/ui/components/sidebar | slider | toast
  hooks/use-*.ts           Presentation hooks              @kyomi/ui/hooks/<name>
  icons/                   Kyomi artwork + Mingcute        @kyomi/ui/icons, @kyomi/ui/icons/<name>
  lib/                     Utilities and engines           @kyomi/ui/lib/utils | motion | squircle | scrubber
  native/                  Native-safe contracts           @kyomi/ui/native/theme | motion
  styles/                  globals.css + token modules     @kyomi/ui/globals.css, @kyomi/ui/styles/<file>.css
```

Import concrete subpaths; there is no root barrel. Web resolves `@kyomi/ui` through the export map
in `package.json`, so a file that is not exported is private.

## Tokens

`styles/theme.css` holds every token. Primitives use them instead of arbitrary values; app code
should reach for a primitive variant before restyling one.

| Token                 | Utility                          | Use                                                   |
| --------------------- | -------------------------------- | ----------------------------------------------------- |
| `--highlight`         | `bg-highlight`, `text-highlight` | Current-position indicators (scrubber preview tick)   |
| `--muted-solid`       | `bg-muted-solid`                 | Opaque muted chrome that floats over content          |
| `--muted-subtle`      | `text-muted-subtle`              | Placeholders, shortcuts, inactive tabs (muted at 72%) |
| `--tracking-title`    | `tracking-title`                 | Tight list and article titles (−0.012em)              |
| `--ease-out-quint`    | `ease-out-quint`                 | Default UI ease-out: presses, popovers, label swaps   |
| `--ease-in-out-quart` | `ease-in-out-quart`              | On-screen movement between two positions              |
| `--ease-standard`     | `ease-standard`                  | Crossfades and blur reveals                           |
| `--ease-drawer`       | `ease-drawer`                    | Sheets and drawers (iOS curve)                        |

Motion in JavaScript uses `springTransition(kind, prefersReducedMotion)` from
`@kyomi/ui/lib/motion`: bounce-free springs (`quick` 0.24s, `standard` 0.28s, `emphasized` 0.3s)
that become instant under reduced motion. `EASE_OUT_QUINT` mirrors the CSS curve for WAAPI.

## Button

`Button` keeps the coss sizes and variants and adds:

- `shape="pill"`: capsule ends with a concentric inner highlight, at any size.
- Press feedback on every button: `scale(0.96)` on `:active`, skipped under reduced motion. Pass
  `static` to opt out; link buttons never scale.
- `variant="ghost-muted"` for quiet toolbar icons and `variant="soft"` for tinted primary actions.

`ButtonGroup` (also in `button.tsx`) groups related buttons:

- `variant="attached"` (default) joins segments into one bordered control.
- `variant="split"` keeps each segment a separate pill: capsule outer ends, `rounded-sm` inner
  corners, and a 3px gap, like a theme and language switcher.

```tsx
<ButtonGroup aria-label="Theme and language" variant="split">
  <Button onClick={toggleTheme} variant="secondary">
    <ButtonLabel>{theme === "dark" ? "Light" : "Dark"}</ButtonLabel>
  </Button>
  <Button onClick={toggleLanguage} variant="secondary">
    <ButtonLabel>{language === "en" ? "中文" : "English"}</ButtonLabel>
  </Button>
</ButtonGroup>
```

`ButtonLabel` crossfades a changed label through a 2px blur; the button's width snaps to the new
text rather than tweening a layout property. It never animates on first render and swaps instantly
under reduced motion. For arrow-key roving between segments, render the group as a toolbar:
`<ButtonGroup render={<ToolbarPrimitive.Root />}>` with `ToolbarButton` children.

## Menu

`MenuPopup` keeps its geometry in CSS variables so nested corners stay concentric (popup radius =
item radius + 4px padding + 1px border):

- `size="lg"`: 36px items with 16px text at every breakpoint (default items are 32px, 28px from
  `sm`).
- `shape="pill"`: fully rounded items, with the popup radius derived from the item height.
- `maxVisibleItems`: caps the visible rows, scrolls the rest, and clips to the rounded corners.

Use `MenuRadioGroup` with `MenuRadioItem` for single choice (it exposes `aria-checked`).
`indicator="none"` drops the check mark so the checked item can be styled through `data-checked`,
for example as a raised segment.

## Item

`Item` is a list row: `ItemMedia`, `ItemContent` (`ItemTitle`, `ItemDescription`), and
`ItemActions`. Wrap the row's main link or button in `ItemTarget`; its hit area stretches over the
whole row and its focus ring sits inside with a concentric radius, while `ItemActions` stays
clickable above it.

- `size="sm"` for compact rail rows (14px titles over 12px meta), `default` for full-width lists.
- `shape="squircle"` draws continuous corners with a measured clip path; `rounded` uses CSS.
- `selected` keeps the hover surface on, e.g. while bulk-selecting.
- `ItemActions reveal` dims actions until the row is hovered or focused.

## Empty and Toolbar

`Empty size` picks the layout: `sm` inside a rail section, `md` filling a panel, `default`, and
`page` for full-viewport error states. Titles, header width, and media spacing follow the size.
`EmptyMedia variant="illustration"` sizes product illustrations (160px, 176px from `sm`).

`Toolbar variant`: `default` (card surface), `ghost` (no surface, muted icons inside another
surface), and `pill` (44px capsule on `bg-muted-solid`). `ToolbarSeparator inset` is the softer
divider between groups.

## Scrubber

`Scrubber` (`components/scrubber.tsx`) is a tick-mark timeline built on the Base UI slider, so it
inherits the slider's keyboard contract (arrows step one item, PageUp/PageDown move `largeStep`,
Home/End jump to the ends) and native range semantics.

- Ticks magnify around the pointer and spread their neighbours, then settle; the loop stops when
  nothing moves.
- Dragging past either end rubber-bands and springs back.
- `range` darkens the ticks currently visible in the paired view, so the dark run reads as a thumb.
- Lists denser than one tick per 6px share ticks; `groups` draws separators (e.g. months).
- `getLabel` shows a floating label above the hovered or keyboard-focused tick;
  `getAriaValueText` describes each index; `onPreviewChange` reports the item under the pointer
  (wire haptics or sound here).

Pair it with a native horizontal scroller whose scrollbar is hidden:

```tsx
const stripRef = useRef<HTMLDivElement>(null);
const scrub = useScrubberScroll(stripRef);

<div className="overflow-x-auto [scrollbar-width:none]" ref={stripRef}>
  {items.map((item) => (
    <figure data-scrubber-item key={item.id}>…</figure>
  ))}
</div>
<Scrubber
  aria-label="Check-in timeline"
  count={scrub.count}
  getAriaValueText={(index) => describe(items[index])}
  range={scrub.range}
  value={scrub.value}
  onValueChange={scrub.onValueChange}
/>
```

While a programmatic glide runs, `useScrubberScroll` holds `value` at the destination so assistive
technology hears one change instead of every item passed.

## Adding a primitive

1. Prefer a coss registry component; otherwise add `src/components/<name>.tsx` on a Base UI part.
2. Give it `data-slot`, keyboard, focus, disabled, loading, and reduced-motion states.
3. Style it with the tokens above; add a token to `theme.css` only when a value repeats.
4. Export a folder primitive explicitly in `package.json`; flat files are covered by
   `./components/*`.
5. Test the contract under `tests/web/integration/src/packages/ui/components/`.
