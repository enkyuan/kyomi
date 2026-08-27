import ExpoModulesCore
import ExpoUI

public final class KyomiNativeTabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KyomiNativeTabBar")
    ExpoUIView(KyomiTabBarView.self)
  }
}
