import { starterBundles } from "@kyomi/ingest/ingestion/starter-bundles";
import { Item } from "@kyomi/ui/components/item";
import { type CSSProperties, useEffect, useState } from "react";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import "./bundle-choices.css";

const triggerClassName =
  "bundle-trigger flex w-full items-center justify-between gap-3 ps-3 pe-2 text-start text-sm leading-4 font-medium text-foreground";

const bundleDescriptions = {
  technology: "Software & digital rights",
  science: "From particles to planets",
  design: "Design for real people",
  climate: "Climate science & policy",
  culture: "Books, ideas & media",
  business: "How tech businesses grow",
} satisfies Record<(typeof starterBundles)[number]["id"], string>;

export function BundleChoices({
  selected,
  onSelect,
  errorId,
}: {
  selected: string[];
  onSelect?: (bundleId: string) => void;
  errorId?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const previewId = hovered ?? focused;
  const selection = new Set(selected);

  useEffect(() => {
    if (!previewId) return;

    function dismiss(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setHovered(null);
      setFocused(null);
    }

    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [previewId]);

  return (
    <fieldset
      aria-describedby={errorId}
      className="flex min-w-0 flex-col gap-2 [--bundle-trigger-height:--spacing(12)]"
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
        setHovered(event.target.closest<HTMLElement>("[data-bundle]")?.dataset.bundle ?? null);
      }}
      onPointerLeave={() => setHovered(null)}
    >
      <legend className="sr-only">Starter feed bundles</legend>
      {starterBundles.map((bundle) => {
        if (!onSelect) {
          return (
            <div key={bundle.id} className={triggerClassName}>
              {bundle.title}
            </div>
          );
        }

        const descriptionId = `bundle-description-${bundle.id}`;
        const sourcesId = `bundle-sources-${bundle.id}`;
        const pressed = selection.has(bundle.id);
        return (
          <Item
            key={bundle.id}
            shape="squircle"
            size="sm"
            selected={pressed}
            data-bundle={bundle.id}
            data-preview-open={previewId === bundle.id ? "" : undefined}
            className="block bg-muted/60 p-0 ring-inset duration-(--duration-control) data-selected:bg-primary/12 has-[:focus-visible]:ring-(length:--focus-ring-width) has-[:focus-visible]:ring-ring"
          >
            <button
              type="button"
              aria-label={bundle.title}
              aria-pressed={pressed}
              aria-describedby={`${descriptionId} ${sourcesId}`}
              onClick={() => onSelect(bundle.id)}
              onFocus={(event) => {
                if (!event.currentTarget.matches(":focus-visible")) return;
                setHovered(null);
                setFocused(bundle.id);
              }}
              onBlur={() => setFocused(null)}
              className={`${triggerClassName} cursor-pointer outline-none`}
            >
              <span>{bundle.title}</span>
              <span
                id={descriptionId}
                className="bundle-summary w-28 shrink-0 text-end text-xs text-balance text-foreground/80 sm:w-40"
              >
                {bundleDescriptions[bundle.id]}
              </span>
              <span id={sourcesId} className="sr-only">
                {bundle.feeds.map((feed) => feed.title).join(", ")}
              </span>
            </button>
            <ul
              aria-hidden="true"
              style={{ "--source-count": bundle.feeds.length } as CSSProperties}
              className="bundle-sources pointer-events-none text-foreground/80"
            >
              {bundle.feeds.map((feed, index) => (
                <li
                  key={feed.url}
                  style={
                    {
                      "--source-index": index,
                      "--from-end": bundle.feeds.length - index - 1,
                    } as CSSProperties
                  }
                  className="bundle-source flex h-(--source-height) items-center justify-between gap-3 ps-3 pe-2"
                >
                  <span className="bundle-source-name line-clamp-2 text-start text-sm leading-4">
                    {feed.title}
                  </span>
                  <FeedFavicon
                    feedUrl={feed.url}
                    siteUrl={feed.siteUrl}
                    title={feed.title}
                    priority="low"
                    shape="squircle"
                    squircleCornerRadius={8}
                    className="bundle-source-icon size-7 border border-border bg-card"
                  />
                </li>
              ))}
            </ul>
          </Item>
        );
      })}
    </fieldset>
  );
}
