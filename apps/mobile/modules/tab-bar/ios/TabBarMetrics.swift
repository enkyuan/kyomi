import CoreGraphics

/// Geometry of Kyomi's floating tab bar.
///
/// The bar keeps the proportions of Kyomi's original 48pt design and scales
/// every dimension so its capsule matches the iOS 26 system tab bar. On the
/// iOS 26.3 and 27.0 simulators (iPhone 16e, 17, Air, 17 Pro), `UITabBar`
/// draws a 62pt capsule and a 62pt search button, insets its selection lens
/// 4pt, and rests 21pt from the screen edges.
enum TabBarMetrics {
  static let systemHeight: CGFloat = 62
  static let designHeight: CGFloat = 48
  static let scale = systemHeight / designHeight

  static let height = designHeight * scale
  static let compactHeight = 44 * scale
  static let mainWidth = 168 * scale
  static let compactMainWidth = 150 * scale
  /// Distance from the screen's side and bottom edges (system: 21pt).
  static let edgeInset = 16 * scale
  static let gap = 10 * scale
  /// Inset of the selection lens from the capsule (system: 4pt).
  static let selectionInset = 3 * scale
  /// `UISegmentedControl` draws its selection lens this far inside each segment.
  static let segmentLensInset: CGFloat = 2
  /// The switcher redirects to another view instead of selecting a tab, so it
  /// takes a narrower slot than the tabs.
  static let switcherWidthRatio: CGFloat = 0.6

  static let tabIconSize = 25 * scale
  static let switcherIconSize = 20 * scale
  static let searchIconSize = 18 * scale
  static let closeIconSize = 16 * scale
  static let searchFieldPadding = 14 * scale
  static let searchFieldSpacing = 8 * scale
  static let searchFieldIconWidth = 22 * scale

  /// Space kept between the bar and the keyboard while it is visible.
  static let keyboardGap = 12 * scale
  /// Height React Native reserves for the bar: the capsule and its resting gap.
  static let containerHeight = height + edgeInset
}

/// Resolved geometry for one state of the bar.
struct TabBarLayout: Equatable {
  let barHeight: CGFloat
  let mainWidth: CGFloat
  let actionSize: CGFloat
  let iconScale: CGFloat
  /// Whole-point widths of the tab segments followed by the switcher segment.
  /// `UISegmentedControl` floors fractional widths, so the icons and the
  /// selection lens share these values.
  let segmentWidths: [CGFloat]
  let segmentHeight: CGFloat

  init(containerWidth: CGFloat, tabCount: Int, hasSwitcher: Bool, minimized: Bool, searchActive: Bool) {
    let compact = minimized && !searchActive
    barHeight = compact ? TabBarMetrics.compactHeight : TabBarMetrics.height
    actionSize = barHeight
    iconScale = barHeight / TabBarMetrics.height

    let availableWidth = max(0, containerWidth - TabBarMetrics.edgeInset * 2)
    let maximumMainWidth = max(0, availableWidth - TabBarMetrics.gap - actionSize)
    let tabsWidth = min(compact ? TabBarMetrics.compactMainWidth : TabBarMetrics.mainWidth, maximumMainWidth)
    mainWidth = searchActive ? maximumMainWidth : tabsWidth

    // Inset the control so its lens sits `selectionInset` from the capsule.
    // UISegmentedControl sizes itself in whole points, so round its height.
    let controlInset = TabBarMetrics.selectionInset - TabBarMetrics.segmentLensInset
    segmentHeight = (barHeight - controlInset * 2).rounded()
    let controlWidth = max(0, tabsWidth - controlInset * 2)
    let units = CGFloat(tabCount) + (hasSwitcher ? TabBarMetrics.switcherWidthRatio : 0)
    let tabWidth = units > 0 ? (controlWidth / units).rounded(.down) : 0
    var widths = Array(repeating: tabWidth, count: tabCount)
    if hasSwitcher {
      widths.append((controlWidth - tabWidth * CGFloat(tabCount)).rounded(.down))
    }
    segmentWidths = widths
  }

  var segmentsWidth: CGFloat {
    segmentWidths.reduce(0, +)
  }
}
