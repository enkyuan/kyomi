import { cn } from "@kyomi/ui/lib/utils";

const MAX_VISIBLE_CHIPS = 2;

type CategoriesProps = {
  categories: string[];
  /** Meta font size in px, kept in sync with the footer's saved chip and timestamp. */
  fontSizePx: number;
  className?: string;
};

/**
 * Renders up to two category chips in the feed item footer. Overflow beyond two is
 * summarized as a `+N` chip with an accessible label listing the hidden categories.
 */
export function Categories({ categories, fontSizePx, className }: CategoriesProps) {
  if (categories.length === 0) {
    return null;
  }

  const visible = categories.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = categories.slice(MAX_VISIBLE_CHIPS);

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {visible.map((category) => (
        <span
          key={category}
          className="min-w-0 shrink truncate rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground/85"
          style={{ fontSize: `${fontSizePx}px` }}
        >
          {category}
        </span>
      ))}
      {overflow.length > 0 ? (
        <span
          aria-label={`${overflow.length} more categories: ${overflow.join(", ")}`}
          title={overflow.join(", ")}
          className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground/85 tabular-nums"
          style={{ fontSize: `${fontSizePx}px` }}
        >
          +{overflow.length}
        </span>
      ) : null}
    </div>
  );
}
