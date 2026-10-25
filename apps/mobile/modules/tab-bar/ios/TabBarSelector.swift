import SwiftUI
import UIKit

/// The tab selection indicator: a `UISegmentedControl` with its track hidden so
/// only the system's Liquid Glass lens shows. The control supplies the native
/// lens, its drag-to-select behavior, and its animation; the tab icons are
/// drawn by SwiftUI above it.
///
/// Approach adapted from union-tab-view by Union St (MIT):
/// https://github.com/unionst/union-tab-view
struct TabBarSelector: UIViewRepresentable {
  var segmentWidths: [CGFloat]
  var height: CGFloat
  var selectedIndex: Int
  var onSelect: (Int) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(parent: self)
  }

  func makeUIView(context: Context) -> TabSegmentedControl {
    let control = TabSegmentedControl(frame: .zero)
    control.backgroundColor = .clear
    control.selectedSegmentTintColor = Self.lensTint
    // SwiftUI exposes the tab items to VoiceOver instead.
    control.isAccessibilityElement = false
    control.accessibilityElementsHidden = true
    control.addTarget(
      context.coordinator,
      action: #selector(Coordinator.valueChanged(_:)),
      for: .valueChanged
    )
    control.onPress = { [weak coordinator = context.coordinator] index in
      coordinator?.commit(index)
    }
    configure(control)
    control.selectedSegmentIndex = selectedIndex
    context.coordinator.committedIndex = selectedIndex
    return control
  }

  func updateUIView(_ control: TabSegmentedControl, context: Context) {
    context.coordinator.parent = self
    if needsConfiguration(control) {
      context.animate {
        configure(control)
        control.layoutIfNeeded()
      }
    }
    if control.selectedSegmentIndex != selectedIndex {
      control.selectedSegmentIndex = selectedIndex
    }
    context.coordinator.committedIndex = selectedIndex
  }

  // UISegmentedControl reports a 32pt intrinsic height; the lens follows
  // whatever height the control is given.
  func sizeThatFits(_ proposal: ProposedViewSize, uiView: TabSegmentedControl, context: Context) -> CGSize? {
    CGSize(width: segmentWidths.reduce(0, +), height: height)
  }

  private func needsConfiguration(_ control: TabSegmentedControl) -> Bool {
    control.numberOfSegments != segmentWidths.count
      || segmentWidths.indices.contains { control.widthForSegment(at: $0) != segmentWidths[$0] }
  }

  private func configure(_ control: TabSegmentedControl) {
    if control.numberOfSegments != segmentWidths.count {
      control.removeAllSegments()
      for index in segmentWidths.indices {
        control.insertSegment(withTitle: "", at: index, animated: false)
      }
    }
    for (index, width) in segmentWidths.enumerated() {
      control.setWidth(width, forSegmentAt: index)
    }
  }

  /// The selection platter tint from Kyomi's original bar.
  private static let lensTint = UIColor { traits in
    traits.userInterfaceStyle == .dark
      ? UIColor(white: 0, alpha: 0.32)
      : UIColor(white: 1, alpha: 0.42)
  }

  @MainActor
  final class Coordinator: NSObject {
    var parent: TabBarSelector
    var committedIndex = 0

    init(parent: TabBarSelector) {
      self.parent = parent
    }

    func commit(_ index: Int) {
      committedIndex = index
      parent.onSelect(index)
    }

    /// Fires when a drag across the control lands on another segment.
    @objc func valueChanged(_ control: TabSegmentedControl) {
      let index = control.selectedSegmentIndex
      guard index >= 0, index != committedIndex else { return }
      commit(index)
    }
  }
}

final class TabSegmentedControl: UISegmentedControl {
  /// Called when a touch selects a segment, and when a tap lands on the
  /// segment that is already selected.
  var onPress: ((Int) -> Void)?
  private var reselectCandidate: Int?

  // UISegmentedControl reports a 1pt bottom alignment inset, which makes
  // SwiftUI size it 1pt taller than its slot and pushes the lens off center.
  override var alignmentRectInsets: UIEdgeInsets {
    .zero
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Hide the track and separators; the last subview holds the lens.
    let indicator = subviews.last
    for subview in subviews where subview is UIImageView && subview !== indicator {
      subview.alpha = 0
    }
  }

  // Commit a new selection on touch-down, as a tab bar does. The interactive
  // glass around the control can otherwise claim a quick tap before the
  // control's own touch-up selection runs.
  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
    reselectCandidate = nil
    if let touch = touches.first,
      let index = segmentIndex(at: touch.location(in: self).x)
    {
      if selectedSegmentIndex == index {
        reselectCandidate = index
      } else {
        selectedSegmentIndex = index
        onPress?(index)
      }
    }
    super.touchesBegan(touches, with: event)
  }

  // A press on the selected tab counts only once it ends on that tab, so a drag
  // that starts there and selects another tab is not also a reselect.
  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
    if let candidate = reselectCandidate,
      let touch = touches.first,
      segmentIndex(at: touch.location(in: self).x) == candidate,
      selectedSegmentIndex == candidate
    {
      onPress?(candidate)
    }
    reselectCandidate = nil
    super.touchesEnded(touches, with: event)
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
    reselectCandidate = nil
    super.touchesCancelled(touches, with: event)
  }

  private func segmentIndex(at x: CGFloat) -> Int? {
    guard numberOfSegments > 0, bounds.width > 0 else { return nil }
    var segmentEnd: CGFloat = 0
    for index in 0..<numberOfSegments {
      segmentEnd += widthForSegment(at: index)
      if x < segmentEnd { return index }
    }
    return numberOfSegments - 1
  }
}
