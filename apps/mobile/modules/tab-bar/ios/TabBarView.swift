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
  let onReaderToolPress = EventDispatcher()
  let onReaderFontSizeChange = EventDispatcher()

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
    model.onReaderToolPress = { [weak self] key in
      self?.onReaderToolPress(["key": key])
    }
    model.onReaderFontSizeChange = { [weak self] size, committed in
      self?.onReaderFontSizeChange(["size": size, "committed": committed])
    }
    model.onShareRequest = { [weak self] url, frame in
      self?.presentShareSheet(url: url, sourceFrame: frame)
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

  /// Opens the system share sheet for `url`, morphing out of the capsule. iOS 26 morphs a sheet out of
  /// its `sourceItem`, so a Liquid Glass view stands in for the SwiftUI capsule, with the capsule's
  /// frame and shape, while the SwiftUI capsule hides: the sheet grows out of glass that looks exactly
  /// like the bar, and contracts back into it when dismissed.
  private func presentShareSheet(url: String, sourceFrame: CGRect) {
    guard let link = URL(string: url), let presenter = topViewController() else { return }

    let source = UIVisualEffectView(effect: UIGlassEffect())
    source.frame = sourceFrame
    source.layer.cornerRadius = sourceFrame.height / 2
    source.layer.cornerCurve = .continuous
    source.clipsToBounds = true
    source.isUserInteractionEnabled = false
    addSubview(source)
    model.shareInFlight = true

    let share = UIActivityViewController(activityItems: [link], applicationActivities: nil)
    share.popoverPresentationController?.sourceItem = source
    share.completionWithItemsHandler = { [weak self, weak source] _, _, _, _ in
      source?.removeFromSuperview()
      self?.model.shareInFlight = false
    }
    presenter.present(share, animated: true)
  }

  /// The view controller on top of whatever is presented, which a new presentation must come from.
  private func topViewController() -> UIViewController? {
    var top = window?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
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
