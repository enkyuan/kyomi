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
    // React Native places the host, and the bar clears the device's edges itself, so only the
    // keyboard feeds the safe area: the bar rises above it natively, in the keyboard's own
    // animation, instead of waiting on a JavaScript round trip that raced the search transition.
    hostingController.safeAreaRegions = .keyboard
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

#if DEBUG
  // Numerical probe for the capsule/sheet morph. Launch with KYOMI_TABBAR_PROBE=1 and read the
  // `[tabbar-probe]` lines from the console. SwiftUI's own geometry reports the target of an
  // animation at once, so this samples what is on screen: the tab selector's presentation layer
  // (the segmented control sits in the same row as the icons), in window coordinates, and the
  // opacity it is drawn with, once per display frame while either changes.
  private var probeLink: CADisplayLink?
  private var probeLast = ""
  private var probeQuiet = 0
  private weak var probeSelector: UISegmentedControl?

  private func startProbeIfRequested() {
    guard probeLink == nil, ProcessInfo.processInfo.environment["KYOMI_TABBAR_PROBE"] == "1" else { return }
    let link = CADisplayLink(target: self, selector: #selector(probeTick(_:)))
    link.add(to: .main, forMode: .common)
    probeLink = link
  }

  private func findSelector(in view: UIView) -> UISegmentedControl? {
    if let control = view as? UISegmentedControl { return control }
    for child in view.subviews { if let found = findSelector(in: child) { return found } }
    return nil
  }

  @objc private func probeTick(_ link: CADisplayLink) {
    if probeSelector == nil { probeSelector = findSelector(in: hostingController.view) }
    guard let selector = probeSelector, let window, let layer = selector.layer.presentation() else { return }
    let windowLayer = window.layer.presentation() ?? window.layer
    let rect = layer.convert(layer.bounds, to: windowLayer)
    var opacity: Float = 1
    var current: CALayer? = layer
    while let node = current {
      opacity *= node.opacity
      current = node.superlayer
    }
    // The glass: the tallest presentation layer (in window coordinates) whose class names glass or
    // backdrop and that is at least as wide as the capsule.
    var glass = CGRect.null
    func visit(_ node: CALayer) {
      let name = NSStringFromClass(type(of: node))
      if name.contains("Glass") || name.contains("Backdrop"), let shown = node.presentation() {
        let frame = shown.convert(shown.bounds, to: windowLayer)
        if frame.width >= 140, frame.height >= 40, frame.height > glass.height { glass = frame }
      }
      node.sublayers?.forEach(visit)
    }
    visit(hostingController.view.layer)
    let line = String(
      format: "y=%.2f midY=%.2f x=%.2f w=%.2f h=%.2f alpha=%.3f presented=%d glassMinY=%.2f glassMaxY=%.2f glassH=%.2f",
      rect.minY, rect.midY, rect.minX, rect.width, rect.height, opacity, model.switcherPresented ? 1 : 0,
      glass.isNull ? -1 : glass.minY, glass.isNull ? -1 : glass.maxY, glass.isNull ? -1 : glass.height)
    if line == probeLast {
      probeQuiet += 1
      return
    }
    probeQuiet = 0
    probeLast = line
    NSLog("[tabbar-probe] t=%.4f %@", link.timestamp, line)
  }
#else
  private func startProbeIfRequested() {}
#endif

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      startProbeIfRequested()
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
