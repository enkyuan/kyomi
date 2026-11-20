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

  /// Width of one reader tool's slot: the HIG's 44pt minimum target, with room around the glyph.
  /// Over a minimized bar the reader's capsule exists only from this far into the morph, so it always
  /// has its tools on it and never shows as empty glass on the way to or from a circle.
  static let minimizedReaderEdge: CGFloat = 0.45
  /// The least a reader tool is given; the bar normally fills the width and the tools share it.
  static let readerToolSlot: CGFloat = 64
  /// The reader bar's tools, for sizing its capsule before JavaScript has said what they are: the stack
  /// starts sliding the reader in before the reader's first render has finished.
  static let readerToolCount = 5
  /// The text size panel above the reader bar: tall enough for the slider's 44pt target.
  static let fontPanelHeight: CGFloat = 56
  static let fontPanelInset: CGFloat = 20
  /// Width reserved for the `textformat` glyph and for the size, whose digits are tabular.
  static let fontPanelSideWidth: CGFloat = 28
  /// Search and the add composer replace the bar with a native-sized field and a close button, both
  /// this tall: the height of the toolbar search field the system draws, not of the tab bar.
  static let fieldHeight: CGFloat = 48
  /// The field's glyph, at the search button's glyph scaled to the field.
  static let fieldIconSize = searchIconSize * fieldHeight / height
  /// The field's text starts this far from its leading edge, beside the glyph, and stops
  /// `fieldTextTrailing` short of the trailing one.
  static let fieldTextInset: CGFloat = 44
  static let fieldTextTrailing: CGFloat = 12
  /// Height of a feed in the composer's results, and the space kept between them and the field.
  static let composerResultHeight: CGFloat = 60
  /// The clear space between the status bar and the first result's icon.
  static let composerFirstRowGap: CGFloat = 2
  /// How far the first result is drawn up into the margin under the status bar: a row centers its 36pt
  /// icon, so the rest of its slack above the icon is lifted away, leaving `composerFirstRowGap`.
  static let composerFirstRowLift: CGFloat = (composerResultHeight - 36) / 2 - composerFirstRowGap
  static let composerResultsGap: CGFloat = 12
  /// The plus or check ending a result, and the touch target around it (the HIG's 44pt minimum).
  static let composerMarkSize: CGFloat = 30
  static let composerMarkTarget: CGFloat = 44
  /// How far below the status bar the results fade in; zero ends them at the status bar's edge.
  static let composerFadeLength: CGFloat = 0
}

/// Resolved geometry for one state of the bar: a search button at the leading edge, the tab capsule
/// centred between the buttons, and an add button at the trailing edge, as in the iOS 26 tab bar.
struct TabBarLayout: Equatable {
  /// Height of the tab capsule (the buttons use `buttonSize`).
  let barHeight: CGFloat
  /// Vertical centre of the bar's band in the container.
  let barMidY: CGFloat
  /// Diameter of the search and add buttons. They shrink while the bar is minimized.
  let buttonSize: CGFloat
  /// `buttonSize` relative to the expanded height, for scaling button glyphs.
  let buttonScale: CGFloat
  /// Frame of the tab capsule's glass.
  let mainWidth: CGFloat
  let mainX: CGFloat
  /// The leading element: the search button, or the field it widens into while searching. They share
  /// one glass, so this is the frame that glass moves between. The add composer, which draws its own
  /// field, takes this frame from a layout built as if searching.
  let searchRect: CGRect
  /// The trailing element: the add button, or the close button it becomes beside the field.
  let trailingRect: CGRect
  /// Minimized or searching: the capsule is hidden.
  let showsMain: Bool
  /// The open sheet covers both buttons' places, so they are gone while it is presented.
  let showsButtons: Bool
  /// Whole-point widths of the tab segments. `UISegmentedControl` floors
  /// fractional widths, so the icons and the selection lens share these values.
  let segmentWidths: [CGFloat]
  /// Width of the switcher slot after the tabs. It is not a segment of the control, so the
  /// selection lens can never land on it. Zero without a switcher.
  let switcherWidth: CGFloat
  let segmentHeight: CGFloat
  /// Width of one tool of the reader bar; zero outside the reader.
  let readerSegmentWidth: CGFloat

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
    keyboardInset: CGFloat = 0,
    readerToolCount: Int = 0,
    readerMorph: CGFloat = 1
  ) {
    let containerWidth = containerSize.width
    let reading = readerToolCount > 0
    let morph = min(1, max(0, readerMorph))
    // A minimized bar's buttons are compact whether or not a reader is open over it, so they come back
    // at that size when the reader leaves.
    let compact = minimized && !searchActive
    barHeight = TabBarMetrics.height
    buttonSize = compact && !reduceMotion ? TabBarMetrics.compactHeight : TabBarMetrics.height
    // The search and add buttons shrink away over the first half of the morph and grow back over the last
    // half of the return, scrubbed with it like the capsule, so a finger drives them too.
    let presence = reading ? 1 - min(1, morph / 0.5) : 1
    buttonScale = buttonSize / TabBarMetrics.height * presence
    // Reading, the capsule is there while the morph is under way, and at rest only if the tabs are:
    // over a minimized bar it contracts to nothing as the reader leaves and is removed there.
    showsMain = reading ? (!minimized || morph > TabBarMetrics.minimizedReaderEdge) : (!minimized && !searchActive)
    // They leave the hierarchy only once they have shrunk to nothing, where it cannot be seen.
    showsButtons = !sheetPresented && presence > 0.02

    let inset = TabBarMetrics.edgeInset
    let gap = TabBarMetrics.gap
    let availableWidth = max(0, containerWidth - inset * 2)
    // The bar rests `edgeInset` above the bottom of its band, or `keyboardGap` above the keyboard.
    // The field is shorter than the bar, so it keeps the same gap below it rather than the same centre.
    let rowHeight = searchActive ? TabBarMetrics.fieldHeight : barHeight
    barMidY = containerSize.height - max(inset, keyboardInset + TabBarMetrics.keyboardGap) - rowHeight / 2

    // The capsule keeps its size when the bar minimizes (it only hides), so size it for the
    // expanded buttons, which also keeps the tab segments from reflowing.
    let sideReserve = (TabBarMetrics.height + gap) * 2
    let tabsWidth = min(TabBarMetrics.mainWidth, max(0, availableWidth - sideReserve))
    // The capsule's width is the tab capsule's and the reader bar's, mixed by how far the stack's
    // transition has taken the bar from one to the other, so it follows a swipe back with the finger.
    // The reader bar is as wide as a system tab bar with as many items: edge to edge between the
    // screen's insets, its tools sharing the width (never narrower than a slot each).
    let readerWidth = max(
      availableWidth,
      TabBarMetrics.readerToolSlot * CGFloat(readerToolCount) + TabBarMetrics.selectionInset * 2
    )
    // Its resting end is the tab capsule, or a circle where the bar is minimized, so the reader bar
    // contracts into whichever of the two the feed is showing.
    let restWidth = minimized ? TabBarMetrics.height : tabsWidth
    // Reduce Motion swaps between the two ends instead of sweeping through the widths between them.
    let sweep = reduceMotion ? (morph >= 0.5 ? 1 : 0) : morph
    let capsuleWidth = reading ? restWidth + (readerWidth - restWidth) * sweep : tabsWidth
    // The buttons shrink about their centres, so their glyphs scale in place instead of sliding
    // toward the screen edges while the glass contracts.
    let buttonInset = (TabBarMetrics.height - buttonSize) / 2
    let addX = containerWidth - inset - TabBarMetrics.height + buttonInset
    mainWidth = capsuleWidth
    mainX = (containerWidth - capsuleWidth) / 2
    // Searching, the add button's glass becomes the close button at the trailing edge, and the
    // search button's glass widens to the field, ending a gap short of it.
    if searchActive {
      let size = TabBarMetrics.fieldHeight
      trailingRect = CGRect(x: containerWidth - inset - size, y: barMidY - size / 2, width: size, height: size)
      searchRect = CGRect(
        x: inset,
        y: barMidY - size / 2,
        width: max(0, availableWidth - size - gap),
        height: size
      )
    } else {
      let size = buttonSize * presence
      trailingRect = CGRect(x: addX + (buttonSize - size) / 2, y: barMidY - size / 2, width: size, height: size)
      searchRect = CGRect(
        x: inset + buttonInset + (buttonSize - size) / 2, y: barMidY - size / 2, width: size, height: size)
    }
    // Inset the control so its lens sits `selectionInset` from the capsule.
    // UISegmentedControl sizes itself in whole points, so round its height.
    let controlInset = TabBarMetrics.selectionInset - TabBarMetrics.segmentLensInset
    segmentHeight = (barHeight - controlInset * 2).rounded()
    let controlWidth = max(0, tabsWidth - controlInset * 2)
    let units = CGFloat(tabCount) + (hasSwitcher ? TabBarMetrics.switcherWidthRatio : 0)
    let tabWidth = units > 0 ? (controlWidth / units).rounded(.down) : 0
    readerSegmentWidth =
      reading
      ? ((capsuleWidth - TabBarMetrics.selectionInset * 2) / CGFloat(readerToolCount)).rounded(.down)
      : 0
    segmentWidths = Array(repeating: tabWidth, count: tabCount)
    switcherWidth = hasSwitcher ? (controlWidth - tabWidth * CGFloat(tabCount)).rounded(.down) : 0
  }

  /// The capsule's frame in the container.
  var mainRect: CGRect {
    CGRect(x: mainX, y: barMidY - barHeight / 2, width: mainWidth, height: barHeight)
  }

  /// The text size panel: the capsule's width, floating one gap above it.
  var fontPanelRect: CGRect {
    let height = TabBarMetrics.fontPanelHeight
    return CGRect(x: mainX, y: mainRect.minY - TabBarMetrics.gap - height, width: mainWidth, height: height)
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
