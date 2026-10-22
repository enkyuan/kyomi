import ExpoModulesCore
import SwiftUI

public class TabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TabBar")

    // Geometry React Native needs to place the bar and inset content.
    Constant("containerHeight") { Double(TabBarMetrics.containerHeight) }
    Constant("edgeInset") { Double(TabBarMetrics.edgeInset) }
    Constant("keyboardGap") { Double(TabBarMetrics.keyboardGap) }

    View(TabBarView.self) {
      Events("onTabPress", "onAddPress", "onSearchActiveChange", "onSearchQueryChange", "onSearchSubmit")

      Prop("tabs") { (view: TabBarView, tabs: [TabItemRecord]) in
        view.model.tabs = tabs.map(\.item)
      }

      Prop("selectedIndex") { (view: TabBarView, selectedIndex: Int) in
        view.model.selectedIndex = selectedIndex
      }

      Prop("switcher") { (view: TabBarView, switcher: SwitcherRecord?) in
        view.model.switcher = switcher?.switcher
      }

      Prop("searchIcon") { (view: TabBarView, icon: IconRecord?) in
        view.model.searchIcon = icon?.icon
      }

      Prop("addIcon") { (view: TabBarView, icon: IconRecord?) in
        view.model.addIcon = icon?.icon
      }

      Prop("addIconColor") { (view: TabBarView, color: UIColor?) in
        view.model.addIconColor = color.map { Color(uiColor: $0) } ?? Color.black.opacity(0.85)
      }

      Prop("minimized") { (view: TabBarView, minimized: Bool?) in
        view.model.minimized = minimized ?? false
      }

      Prop("activeTintColor") { (view: TabBarView, color: UIColor?) in
        view.model.activeTint = color.map { Color(uiColor: $0) } ?? .accentColor
      }

      Prop("searchPlaceholder") { (view: TabBarView, placeholder: String?) in
        view.model.searchPlaceholder = placeholder ?? "Search"
      }
    }
  }
}

struct IconPathRecord: Record {
  @Field var d: String = ""
  @Field var fillRule: String? = nil
  /// Set for line glyphs, in viewBox units; omitted for filled paths.
  @Field var strokeWidth: Double? = nil
}

struct IconRecord: Record {
  @Field var viewBox: String = "0 0 24 24"
  /// Clockwise rotation in degrees.
  @Field var rotation: Double = 0
  @Field var paths: [IconPathRecord] = []

  var icon: TabBarIcon {
    TabBarIcon(viewBox: viewBox, rotation: rotation, paths: paths.map { (d: $0.d, evenOdd: $0.fillRule == "evenodd", strokeWidth: $0.strokeWidth.map { CGFloat($0) }) })
  }
}

struct TabItemRecord: Record {
  @Field var key: String = ""
  @Field var label: String = ""
  @Field var icon: IconRecord = IconRecord()
  @Field var selectedIcon: IconRecord = IconRecord()

  var item: TabBarItem {
    TabBarItem(id: key, label: label, icon: icon.icon, selectedIcon: selectedIcon.icon)
  }
}

struct SwitcherRecord: Record {
  @Field var title: String = ""
  @Field var label: String = ""
  @Field var hint: String = ""
  @Field var icon: IconRecord = IconRecord()

  var switcher: TabBarSwitcher {
    TabBarSwitcher(title: title, label: label, hint: hint, icon: icon.icon)
  }
}
