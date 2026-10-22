import ExpoModulesCore
import UIKit

final class TabBarView: ExpoView {
  let onTabPress = EventDispatcher()
  let onSwitcherPress = EventDispatcher()
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
    model.onSwitcherPress = { [weak self] in
      self?.onSwitcherPress()
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
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingView.frame = bounds
  }

  // Only the capsule and the search button take touches.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let view = super.hitTest(point, with: event)
    return view === self ? nil : view
  }
}
