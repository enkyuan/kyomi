import { registerWebModule, NativeModule } from "expo";
import type { BottomCornerRadii } from "./ScreenShape.types";

class ScreenShapeModule extends NativeModule<{}> {
  getBottomCornerRadii(): Promise<BottomCornerRadii | null> {
    return Promise.resolve(null);
  }
}

export default registerWebModule(ScreenShapeModule, "ScreenShape");
