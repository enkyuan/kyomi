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
  /// Button size while minimized: smaller than the expanded bar so it recedes, but never below
  /// the 44pt minimum touch target of the HIG.
  static let compactHeight: CGFloat = 44
  static let mainWidth = 168 * scale
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
  /// Drawn at the tab icons' scale so its 2-unit stroke renders at the same weight; the chevron
  /// glyph is smaller than the tab glyphs inside its box, which is what keeps it secondary.
  static let switcherIconSize = tabIconSize
  static let searchIconSize = 18 * scale
  static let addIconSize = 20 * scale
  static let searchFieldPadding = 14 * scale
  static let searchFieldSpacing = 8 * scale
  static let searchFieldIconWidth = 22 * scale

  /// Space kept between the bar and the keyboard while it is visible.
  static let keyboardGap = 12 * scale
  /// Height React Native reserves for the bar: the capsule and its resting gap.
  static let containerHeight = height + edgeInset

  /// The switcher sheet at its medium detent floats this far from the screen's sides and bottom; at
  /// the large detent it meets them, and its top rests on the status bar's edge. Measured from
  /// system sheets on the iOS 26.3 simulator, as are the sheet's corners and close button.
  static let sheetInset: CGFloat = 8
  static let sheetMediumRatio: CGFloat = 0.5
  static let cornerRadius = height / 2
  /// The sheet's top corners at both detents. Its bottom corners follow the display's.
  static let sheetCornerRadius: CGFloat = 38
  static let sheetCloseSize: CGFloat = 44
  /// The close button's distance from the sheet's top and trailing edges.
  static let sheetCloseInset: CGFloat = 20
  static let sheetScrimOpacity = 0.3
  /// A release projected past this share of the medium sheet's height below its detent dismisses.
  static let sheetDismissRatio: CGFloat = 0.5
  /// Release speed, in points per second, above which a drag counts as thrown, and the snap to a
  /// detent may overshoot a little.
  static let sheetFlickVelocity: CGFloat = 500
}

/// Resolved geometry for one state of the bar: a search button at the leading edge, the tab capsule
/// centred between the buttons, and an add button at the trailing edge, as in the iOS 26 tab bar.
struct TabBarLayout: Equatable {
  let containerWidth: CGFloat
  /// Height of the tab capsule (the buttons use `buttonSize`).
  let barHeight: CGFloat
  /// Vertical centre of the bar's band in the container.
  let barMidY: CGFloat
  /// Diameter of the search and add buttons. They shrink while the bar is minimized.
  let buttonSize: CGFloat
  /// `buttonSize` relative to the expanded height, for scaling button glyphs.
  let buttonScale: CGFloat
  /// Frame of the capsule's glass: the tab capsule or the search field.
  let mainWidth: CGFloat
  let mainX: CGFloat
  let addX: CGFloat
  /// The leading element: the search button, or the search field it grows into while searching.
  /// They share one glass, so this is the frame that glass moves between.
  let searchRect: CGRect
  /// Minimized or searching: the capsule is hidden.
  let showsMain: Bool
  let showsSearchButton: Bool
  let showsTrailing: Bool
  /// Whole-point widths of the tab segments. `UISegmentedControl` floors
  /// fractional widths, so the icons and the selection lens share these values.
  let segmentWidths: [CGFloat]
  /// Width of the switcher slot after the tabs. It is not a segment of the control, so the
  /// selection lens can never land on it. Zero without a switcher.
  let switcherWidth: CGFloat
  let segmentHeight: CGFloat

  /// `keyboardInset`: how far the keyboard rises into the container, which the bar clears.
  /// `reduceMotion`: minimizing keeps the buttons' size, so it changes nothing's geometry and the
  /// capsule only dissolves, the cross-fade Reduce Motion asks for.
  init(
    containerSize: CGSize,
    tabCount: Int,
    hasSwitcher: Bool,
    minimized: Bool,
    searchActive: Bool,
    reduceMotion: Bool = false,
    sheetPresented: Bool = false,
    keyboardInset: CGFloat = 0
  ) {
    let containerWidth = containerSize.width
    self.containerWidth = containerWidth
    let compact = minimized && !searchActive
    barHeight = TabBarMetrics.height
    buttonSize = compact && !reduceMotion ? TabBarMetrics.compactHeight : TabBarMetrics.height
    buttonScale = buttonSize / TabBarMetrics.height
    // Searching hides the capsule like minimizing does: it stays mounted, without its glass.
    showsMain = !minimized && !searchActive
    // The open sheet covers both buttons' places; they materialize out into its glass.
    showsSearchButton = !sheetPresented
    showsTrailing = !sheetPresented

    let inset = TabBarMetrics.edgeInset
    let gap = TabBarMetrics.gap
    let availableWidth = max(0, containerWidth - inset * 2)
    // The bar rests `edgeInset` above the bottom of its band, or `keyboardGap` above the keyboard.
    barMidY = containerSize.height - max(inset, keyboardInset + TabBarMetrics.keyboardGap) - barHeight / 2

    // The capsule keeps its size when the bar minimizes (it only hides), so size it for the
    // expanded buttons, which also keeps the tab segments from reflowing.
    let sideReserve = (TabBarMetrics.height + gap) * 2
    let tabsWidth = min(TabBarMetrics.mainWidth, max(0, availableWidth - sideReserve))
    // The buttons shrink about their centres, so their glyphs scale in place instead of sliding
    // toward the screen edges while the glass contracts.
    let buttonInset = (TabBarMetrics.height - buttonSize) / 2
    addX = containerWidth - inset - TabBarMetrics.height + buttonInset
    mainWidth = tabsWidth
    mainX = (containerWidth - tabsWidth) / 2
    // Searching, the button's glass grows to the field, ending a gap short of the close button.
    searchRect = searchActive
      ? CGRect(
        x: inset,
        y: barMidY - barHeight / 2,
        width: max(0, availableWidth - barHeight - gap),
        height: barHeight
      )
      : CGRect(x: inset + buttonInset, y: barMidY - buttonSize / 2, width: buttonSize, height: buttonSize)
    // Inset the control so its lens sits `selectionInset` from the capsule.
    // UISegmentedControl sizes itself in whole points, so round its height.
    let controlInset = TabBarMetrics.selectionInset - TabBarMetrics.segmentLensInset
    segmentHeight = (barHeight - controlInset * 2).rounded()
    let controlWidth = max(0, tabsWidth - controlInset * 2)
    let units = CGFloat(tabCount) + (hasSwitcher ? TabBarMetrics.switcherWidthRatio : 0)
    let tabWidth = units > 0 ? (controlWidth / units).rounded(.down) : 0
    segmentWidths = Array(repeating: tabWidth, count: tabCount)
    switcherWidth = hasSwitcher ? (controlWidth - tabWidth * CGFloat(tabCount)).rounded(.down) : 0
  }

  /// The capsule's frame in the container.
  var mainRect: CGRect {
    CGRect(x: mainX, y: barMidY - barHeight / 2, width: mainWidth, height: barHeight)
  }

  /// Width of the segmented control, which spans the tabs only.
  var segmentsWidth: CGFloat {
    segmentWidths.reduce(0, +)
  }
}

enum SwitcherSheetDetent {
  case medium
  case large
}

/// Where the switcher sheet's glass sits for a detent and a drag, in the bar's full-screen container.
struct SwitcherSheetGeometry {
  let container: CGSize
  let safeTop: CGFloat

  /// The medium sheet's bottom edge, where a sheet dragged below the medium detent slides from.
  var bottom: CGFloat { container.height - TabBarMetrics.sheetInset }

  func top(_ detent: SwitcherSheetDetent) -> CGFloat {
    switch detent {
    case .medium: container.height * (1 - TabBarMetrics.sheetMediumRatio)
    case .large: safeTop
    }
  }

  /// The top edge under a drag from `detent`: free between the detents and below them, resisting
  /// more the further it is pulled above the large detent.
  func top(_ detent: SwitcherSheetDetent, drag: CGFloat) -> CGFloat {
    let position = top(detent) + drag
    let limit = top(.large)
    guard position < limit else { return position }
    let overshoot = limit - position
    let constant: CGFloat = 0.55
    return limit - (overshoot * container.height * constant) / (container.height + constant * overshoot)
  }

  /// How far the sheet is from the medium detent (0) to the large one (1), for a top edge.
  func largeProgress(top: CGFloat) -> CGFloat {
    let mediumTop = self.top(.medium)
    let span = max(1, mediumTop - self.top(.large))
    return min(1, max(0, (mediumTop - top) / span))
  }

  /// The glass for a top edge. Above the medium detent the sheet grows, and its margins close as it
  /// nears the large detent, where it runs edge to edge and flush with the bottom like a system
  /// sheet. Below the medium detent it keeps the medium size and slides down, as a system sheet
  /// being dismissed does.
  func frame(top: CGFloat) -> CGRect {
    let mediumTop = self.top(.medium)
    let inset = TabBarMetrics.sheetInset * (1 - largeProgress(top: top))
    let height = top > mediumTop ? bottom - mediumTop : container.height - inset - top
    return CGRect(x: inset, y: top, width: max(0, container.width - inset * 2), height: max(0, height))
  }

  /// How visible the dimming is for a top edge: full at or above the medium detent, fading as the
  /// sheet slides down towards dismissal.
  func dimming(top: CGFloat) -> Double {
    let mediumTop = self.top(.medium)
    guard top > mediumTop else { return 1 }
    return Double(max(0, 1 - (top - mediumTop) / max(1, bottom - mediumTop)))
  }
}
