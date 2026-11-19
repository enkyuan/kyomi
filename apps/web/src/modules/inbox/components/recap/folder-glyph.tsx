"use client";

import { FolderFilledIcon, StarFilledIcon, StarIcon } from "@kyomi/ui/icons/blode";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "@kyomi/ui/lib/motion";
import { useState } from "react";
import type { RecapFolder } from "../../lib/recap/types";

/**
 * The folder's glyph, which turns into a star on hover: tap it to pin (outline) or unpin (filled,
 * in the palette's amber). Icons swap with the shared recipe: scale 0.25 to 1, opacity and a 4px
 * blur, on a spring with no bounce.
 */
export function FolderGlyph({
  alwaysStar,
  disabled,
  folder,
  onTogglePin,
}: {
  alwaysStar: boolean;
  disabled: boolean;
  folder: RecapFolder;
  onTogglePin: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const Star = folder.isPinned ? StarFilledIcon : StarIcon;
  const swap = {
    animate: { filter: "blur(0px)", opacity: 1, scale: 1 },
    exit: reduced ? { opacity: 0 } : { filter: "blur(4px)", opacity: 0, scale: 0.25 },
    initial: reduced ? { opacity: 0 } : { filter: "blur(4px)", opacity: 0, scale: 0.25 },
    transition: { bounce: 0, duration: 0.3, type: "spring" as const },
  };

  return (
    <LazyMotion features={domAnimation}>
      <button
        aria-label={folder.isPinned ? `Unpin ${folder.name}` : `Pin ${folder.name}`}
        className="relative mx-0.5 grid size-5 shrink-0 place-items-center rounded-md outline-none"
        disabled={disabled}
        type="button"
        onBlur={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePin();
        }}
        onFocus={() => setHovered(true)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {hovered || alwaysStar ? (
            <m.span key="star" className="absolute grid place-items-center" {...swap}>
              <Star
                className={`size-5 ${folder.isPinned ? "text-amber-500" : "text-muted-foreground"}`}
              />
            </m.span>
          ) : (
            <m.span key="folder" className="absolute grid place-items-center" {...swap}>
              <FolderFilledIcon className="size-5 text-muted-foreground" />
            </m.span>
          )}
        </AnimatePresence>
      </button>
    </LazyMotion>
  );
}
