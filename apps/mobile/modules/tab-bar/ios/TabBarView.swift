import ExpoModulesCore
import UIKit

final class TabBarView: ExpoView {
  let onTabPress = EventDispatcher()
  let onSearchActiveChange = EventDispatcher()
  let onSearchQueryChange = EventDispatcher()
  let onSearchSubmit = EventDispatcher()
  let onComposerActiveChange = EventDispatcher()
  let onComposerQueryChange = EventDispatcher()
  let onComposerSubmit = EventDispatcher()
  let onSwitcherFolderAction = EventDispatcher()

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
    model.onComposerActiveChange = { [weak self] active in
      self?.onComposerActiveChange(["active": active])
    }
    model.onComposerQueryChange = { [weak self] query in
      self?.onComposerQueryChange(["query": query])
    }
    model.onComposerSubmit = { [weak self] feedId, url, folderId in
      self?.onComposerSubmit(["feedId": feedId, "url": url, "folderId": folderId])
    }
    model.onSwitcherFolderAction = { [weak self] action, folderId, name in
      self?.onSwitcherFolderAction(["action": action, "folderId": folderId, "name": name])
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
