"use client";

import { TextMorph as TorphTextMorph, type TextMorphProps } from "torph/react";

// Web Animations cannot read `--ease-out-quint`, so the token's curve is mirrored here.
const TEXT_MORPH_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const TEXT_MORPH_DURATION_MS = 240;

export type { TextMorphProps };

/**
 * Text that morphs in place when it changes: characters shared with the old text glide to their new
 * position and the rest fade, and numbers roll by place value. The first render never animates and
 * reduced motion swaps instantly. Children must be text; wrap a label, not a tree.
 */
export function TextMorph({
  duration = TEXT_MORPH_DURATION_MS,
  ease = TEXT_MORPH_EASE,
  ...props
}: TextMorphProps) {
  return <TorphTextMorph duration={duration} ease={ease} {...props} />;
}
