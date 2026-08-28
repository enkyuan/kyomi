import ExpoModulesCore

public class HeaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Header")

    View(HeaderView.self) {
      Prop("title") { (view: HeaderView, title: String) in
        view.title = title
      }

      Prop("collapseProgress") { (view: HeaderView, collapseProgress: Double) in
        view.collapseProgress = collapseProgress
      }

      Prop("topInset") { (view: HeaderView, topInset: Double) in
        view.topInset = topInset
      }
    }
  }
}
