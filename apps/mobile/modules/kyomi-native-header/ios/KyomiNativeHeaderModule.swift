import ExpoModulesCore

public class KyomiNativeHeaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KyomiNativeHeader")

    View(KyomiNativeHeaderView.self) {
      Prop("title") { (view: KyomiNativeHeaderView, title: String) in
        view.title = title
      }

      Prop("collapseProgress") { (view: KyomiNativeHeaderView, collapseProgress: Double) in
        view.collapseProgress = collapseProgress
      }

      Prop("topInset") { (view: KyomiNativeHeaderView, topInset: Double) in
        view.topInset = topInset
      }
    }
  }
}
