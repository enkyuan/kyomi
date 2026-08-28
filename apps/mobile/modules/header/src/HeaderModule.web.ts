import { registerWebModule, NativeModule } from "expo";

// HeaderModule is not available on the web platform.
class HeaderModule extends NativeModule<{}> {}

export default registerWebModule(HeaderModule, "Header");
