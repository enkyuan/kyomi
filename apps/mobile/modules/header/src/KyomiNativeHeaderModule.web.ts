import { registerWebModule, NativeModule } from "expo";

// KyomiNativeHeaderModule is not available on the web platform.
class KyomiNativeHeaderModule extends NativeModule<{}> {}

export default registerWebModule(KyomiNativeHeaderModule, "KyomiNativeHeaderModule");
