import { requireOptionalNativeModule } from "expo";
import type { BottomCornerRadii } from "./ScreenShape.types";

type ScreenShapeNativeModule = {
  getBottomCornerRadii(): Promise<BottomCornerRadii | null>;
};

const unavailable: ScreenShapeNativeModule = {
  getBottomCornerRadii: async () => null,
};

export default requireOptionalNativeModule<ScreenShapeNativeModule>("ScreenShape") ?? unavailable;
