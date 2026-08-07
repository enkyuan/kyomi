import { useEffect, useState } from "react";
import ScreenShape, { type BottomCornerRadii } from "../../../../../modules/screen-shape";
import type { BottomScreenCornerRadii } from "../lib/styles";

function isValidCornerRadii(value: BottomCornerRadii | null): value is BottomScreenCornerRadii {
  return (
    value !== null &&
    Number.isFinite(value.bottomLeft) &&
    value.bottomLeft > 0 &&
    Number.isFinite(value.bottomRight) &&
    value.bottomRight > 0
  );
}

/** Reads the physical lower display corners once per mounted navigator. */
export function useScreenCorners(): BottomScreenCornerRadii | undefined {
  const [corners, setCorners] = useState<BottomScreenCornerRadii>();

  useEffect(() => {
    let isCurrent = true;

    void ScreenShape.getBottomCornerRadii().then(
      (value) => {
        if (isCurrent && isValidCornerRadii(value)) {
          setCorners(value);
        }
      },
      () => {},
    );

    return () => {
      isCurrent = false;
    };
  }, []);

  return corners;
}
