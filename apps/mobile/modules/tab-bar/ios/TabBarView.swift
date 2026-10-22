import ExpoModulesCore
import UIKit

final class TabBarView: ExpoView {
  let onTabPress = EventDispatcher()
  let onAddPress = EventDispatcher()
  let onSearchActiveChange = EventDispatcher()
  let onSearchQueryChange = EventDispatcher()
  let onSearchSubmit = EventDispatcher()

  private let hostingView = TabBarHostingView(frame: .zero)

  var model: TabBarModel {
    hostingView.model
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    addSubview(hostingView)

    model.onTabPress = { [weak self] index in
      self?.onTabPress(["index": index])
    }
    model.onAddPress = { [weak self] in
      self?.onAddPress()
    }
    model.onAddPress = { [weak self] in
      self?.onAddPress()
    }
    model.onSearchActiveChange = { [weak self] active in
      self?.onSearchActiveChange(["active": active])
    }
    model.onSearchQueryChange = { [weak self] query in
      self?.onSearchQueryChange(["query": query])
    }
    model.onSearchSubmit = { [weak self] query in
      self?.onSearchSubmit(["query": query])
    }
    // While the switcher sheet is open, VoiceOver stays inside it, as it does in a system sheet.
    model.onSwitcherPresentedChange = { [weak self] presented in
      self?.accessibilityViewIsModal = presented
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingView.frame = bounds
  }

  // Only the capsule and the search and add buttons take touches.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let view = super.hitTest(point, with: event)
    return view === self ? nil : view
  }
}
