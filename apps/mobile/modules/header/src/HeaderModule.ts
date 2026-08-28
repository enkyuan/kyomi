import { NativeModule, requireNativeModule } from "expo";

declare class HeaderModule extends NativeModule<{}> {}

export default requireNativeModule<HeaderModule>("Header");
