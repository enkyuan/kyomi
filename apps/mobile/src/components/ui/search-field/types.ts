import type { RefObject } from "react";

/** The only imperative capability callers need from a native search field. */
export type SearchFieldRef = {
  focus: () => void;
};

export type SearchFieldProps = {
  readonly accessibilityLabel: string;
  readonly clearAccessibilityLabel: string;
  readonly editable?: boolean;
  readonly inputRef: RefObject<SearchFieldRef | null>;
  readonly onChangeText: ((value: string) => void) | undefined;
  readonly placeholder: string;
  readonly value: string;
};

export const INPUT_COLOR = "#f4f4f5";
export const PLACEHOLDER_COLOR = "#71717a";
export const SEARCH_FIELD_HEIGHT = 56;
