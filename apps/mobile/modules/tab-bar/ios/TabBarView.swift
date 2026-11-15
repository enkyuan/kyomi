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
  private lazy var readerTracker = ReaderTransitionTracker(model: model, host: self)

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
    model.onReaderActiveChange = { [weak self] active in
      self?.readerTracker.readerActiveChanged(active)
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

  /// Opens the system share sheet for `url` the way UIKit does by default, from the topmost view
  /// controller. On iPad it anchors its popover to the capsule.
  private func presentShareSheet(url: String, sourceFrame: CGRect) {
    guard let link = URL(string: url), let presenter = topViewController() else { return }
    let share = UIActivityViewController(activityItems: [link], applicationActivities: nil)
    share.popoverPresentationController?.sourceView = self
    share.popoverPresentationController?.sourceRect = sourceFrame
    presenter.present(share, animated: true)
  }

  /// The view controller on top of whatever is presented, which a new presentation must come from.
  private func topViewController() -> UIViewController? {
    var top = window?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    // The tracker runs whenever the bar is on screen, so it is already watching when the stack starts
    // bringing a reader in, and the bar leaves with the screen's very first frame.
    if window == nil { readerTracker.stop() } else { readerTracker.start() }
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
