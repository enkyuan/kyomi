import { NativeModule, requireNativeModule } from "expo";

declare class KyomiNativeHeaderModule extends NativeModule<{}> {}

export default requireNativeModule<KyomiNativeHeaderModule>("KyomiNativeHeader");
