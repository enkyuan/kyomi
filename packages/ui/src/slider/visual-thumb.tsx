"use client";

import { useMemo } from "react";
import { m, type MotionValue } from "motion/react";
import { springs, THUMB_SIZE, THUMB_SIZE_REST } from "./shared";

const SLIDER_VISUAL_THUMB_CLASS =
  "pointer-events-none absolute top-1/2 left-0 z-10 flex items-center justify-center";

type VisualThumbProps = {
  index: 0 | 1;
  motionX: MotionValue<number>;
  focusedThumb: number | null;
  thumbColor?: string;
  thumbBorderColor?: string;
};

export function VisualThumb({
  index,
  motionX,
  focusedThumb,
  thumbColor,
  thumbBorderColor,
}: VisualThumbProps) {
  const thumbInnerStyle = useMemo(
    () => ({
      backgroundColor: thumbColor ?? "white",
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      border: thumbBorderColor ? `1px solid ${thumbBorderColor}` : undefined,
    }),
    [thumbBorderColor, thumbColor],
  );

  return (
    <m.span
      key={index === 0 ? "visual-thumb-start" : "visual-thumb-end"}
      className={SLIDER_VISUAL_THUMB_CLASS}
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        marginTop: -THUMB_SIZE / 2,
        x: motionX,
      }}
      initial={false}
    >
      <m.span
        className="block rounded-full"
        initial={false}
        animate={{
          width: THUMB_SIZE_REST,
          height: THUMB_SIZE_REST,
        }}
        transition={springs.fast}
        style={thumbInnerStyle}
      />
      <m.span
        className="absolute rounded-full border border-[#6B97FF] pointer-events-none"
        initial={false}
        animate={{
          opacity: focusedThumb === index ? 1 : 0,
          width: THUMB_SIZE + 4,
          height: THUMB_SIZE + 4,
        }}
        transition={springs.fast}
      />
    </m.span>
  );
}
