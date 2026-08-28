import ExpoModulesCore
import ExpoUI

public final class TabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TabBar")
    ExpoUIView(TabBarView.self)
  }
}
