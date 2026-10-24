import SwiftUI
import UIKit

/// Hosts the SwiftUI tab bar inside React Native and lets touches outside the
/// capsule and the search button reach the content underneath. It spans the
/// screen so the switcher sheet can grow out of the capsule.
final class TabBarHostingView: UIView {
  let model: TabBarModel
  private let hostingController: UIHostingController<TabBarContent>

  override init(frame: CGRect) {
    let model = TabBarModel()
    self.model = model
    hostingController = UIHostingController(rootView: TabBarContent(model: model))
    super.init(frame: frame)
    backgroundColor = .clear
    hostingController.view.backgroundColor = .clear
    // React Native positions the bar, including above the keyboard, so the
    // hosted content must not apply safe-area or keyboard insets of its own.
    hostingController.safeAreaRegions = []
    // React Native sizes the host, so SwiftUI never needs to report an intrinsic size back.
    hostingController.sizingOptions = []
    addSubview(hostingController.view)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController.view.frame = bounds
    updateSafeTop()
  }

  /// The hosted content ignores safe areas, so the switcher sheet's large detent learns where the
  /// status bar ends from here, in the bar's own coordinates.
  private func updateSafeTop() {
    guard let window else { return }
    let top = max(0, window.safeAreaInsets.top - convert(CGPoint.zero, to: window).y)
    if model.safeTop != top { model.safeTop = top }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      updateSafeTop()
      guard hostingController.parent == nil, let parent = nearestViewController() else { return }
      // Navigation and tab controllers expect only screens as children.
      guard !(parent is UINavigationController), !(parent is UITabBarController) else { return }
      parent.addChild(hostingController)
      hostingController.didMove(toParent: parent)
    } else if hostingController.parent != nil {
      hostingController.willMove(toParent: nil)
      hostingController.removeFromParent()
    }
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard model.isInteractive(at: point) else { return nil }
    return super.hitTest(point, with: event)
  }

  private func nearestViewController() -> UIViewController? {
    var responder = next
    while let current = responder {
      if let controller = current as? UIViewController { return controller }
      responder = current.next
    }
    return nil
  }
}
