import type { ReactNode } from "react";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { EmptyState } from "./empty-state";

import { EMPTY_STATES, type EmptyStateContent } from "./empty-state-content";

export { EMPTY_STATES };
export type EmptyStateVariant = keyof typeof EMPTY_STATES;

type EmptyStateViewProps = {
  variant: EmptyStateVariant;
  /** Replaces the catalog title, e.g. to echo a search query: No results for “march invoice”. */
  header?: string;
  /** Replaces the catalog description, e.g. to embed a badge. */
  description?: ReactNode;
  height: number;
  topContentInset: number;
};

/** The shared empty-state layout filled from the catalog. */
export function EmptyStateView({
  variant,
  header,
  description,
  height,
  topContentInset,
}: EmptyStateViewProps) {
  const content: EmptyStateContent = EMPTY_STATES[variant];

  return (
    <EmptyState
      asset={<EmptyStateIcon scene={variant} size={176} />}
      description={description ?? content.description}
      header={header ?? content.header}
      height={height}
      topContentInset={topContentInset}
    />
  );
}
