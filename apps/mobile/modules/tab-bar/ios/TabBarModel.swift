import SwiftUI
import UIKit

struct TabBarItem: Identifiable {
  let id: String
  let label: String
  let icon: TabBarIcon
  let selectedIcon: TabBarIcon
}

struct TabBarSwitcher {
  /// Title of the sheet the switcher opens.
  let title: String
  let label: String
  let hint: String
  let icon: TabBarIcon
  /// Glyphs of the sheet's folder chips.
  let editIcon: TabBarIcon
  let sortIcon: TabBarIcon
  let addIcon: TabBarIcon
}

/// A folder listed in the switcher sheet, with the feeds filed in it.
struct SwitcherFolder: Identifiable, Equatable {
  let id: String
  let name: String
  let feedCount: Int
  let createdAt: Date
}

/// A feed filed in a folder, listed when the switcher sheet opens that folder.
struct SwitcherFeed: Identifiable, Equatable {
  let id: String
  let folderID: String
  let title: String
  let faviconURL: URL?
}

/// A feed the add composer offers to follow, or the one it previews to import.
struct ComposerFeed: Identifiable, Equatable {
  let id: String
  /// Set for a feed Kyomi already knows; it is followed by id rather than by address.
  let feedID: String?
  let url: String
  let title: String
  let detail: String?
  let faviconURL: URL?
  let isSubscribed: Bool
}

struct ComposerFolder: Identifiable, Equatable {
  let id: String
  let name: String
}

enum ComposerKind: String {
  case `import`, follow
}

enum ComposerStatus: String {
  case idle, loading, submitting, done, failed
}

/// One tool of the reader bar, drawn from Blode geometry like the tabs' glyphs.
struct ReaderTool: Identifiable {
  let id: String
  let label: String
  let icon: TabBarIcon
  /// The glyph while `isSelected`, usually the filled variant.
  let selectedIcon: TabBarIcon
  let isSelected: Bool
  let isEnabled: Bool
  /// The glyph's colour while `isSelected`; the bar's accent when nil.
  let selectedTint: Color?
}

/// What the reader hands the bar: its tools, and the text size the size tool's slider adjusts.
struct ReaderState {
  let tools: [ReaderTool]
  let fontSize: Double
  let fontRange: ClosedRange<Double>
  let fontLabel: String
  /// The article's link, for the system share sheet the share tool opens.
  let shareURL: String?
}

/// State shared between React Native props, the SwiftUI bar, and the events
/// sent back to JavaScript. Observation tracks each property separately, so a
/// view re-renders only for what it reads: typing a search query redraws the
/// field, not the whole bar.
@MainActor
@Observable
final class TabBarModel {
  var tabs: [TabBarItem] = []
  var switcher: TabBarSwitcher?
  /// The folders the switcher sheet lists; the sheet reports every change to them back to JavaScript.
  var switcherFolders: [SwitcherFolder] = []
  var switcherFeeds: [SwitcherFeed] = []
  /// Magnifying glass drawn in the search button and field; falls back to the SF Symbol.
  var searchIcon: TabBarIcon?
  /// Magnifying glass drawn in the composer's field; falls back to the SF Symbol.
  var composerIcon: TabBarIcon?
  /// Plus drawn on a result not yet followed, and the check on one that is; fall back to SF Symbols.
  var composerAddIcon: TabBarIcon?
  var composerAddedIcon: TabBarIcon?
  /// Plus drawn in the add button; falls back to the SF Symbol.
  var addIcon: TabBarIcon?
  var addIconColor = Color.black.opacity(0.85)
  var selectedIndex = 0
  var minimized = false
  var searchActive = false
  /// The switcher sheet is open: the capsule's glass has grown into it.
  var switcherPresented = false {
    didSet {
      if switcherPresented != oldValue { onSwitcherPresentedChange(switcherPresented) }
    }
  }
  /// Where the status bar ends, in the bar's coordinates; the sheet's large detent stops below it.
  var safeTop: CGFloat = 0
  var searchQuery = "" {
    didSet {
      if searchQuery != oldValue { onSearchQueryChange(searchQuery) }
    }
  }
  /// The add composer: the add button's glass widened into a field that takes a feed address to
  /// import or words to search for, with the feeds found listed over the screen behind it, each
  /// with its own folder and Follow (or Import) button.
  var composerActive = false
  var composerQuery = "" {
    didSet {
      if composerQuery != oldValue { onComposerQueryChange(composerQuery) }
    }
  }
  var composerKind = ComposerKind.follow
  var composerFeeds: [ComposerFeed] = []
  var composerFolders: [ComposerFolder] = []
  var composerMessage: String?
  var composerStatus = ComposerStatus.idle {
    didSet {
      if composerStatus == .done, composerActive { toggleComposer() }
    }
  }
  /// The feed whose button was pressed while the submit is in flight.
  private(set) var composerSubmittingID: String?
  var searchPlaceholder = "Search"
  /// The reader's tools. While there are any, the capsule is the reader bar: the tabs give way to
  /// the tools, and the search and add buttons materialize out of the glass.
  var readerTools: [ReaderTool] = []
  var readerFontSize: Double = 17
  var readerFontRange: ClosedRange<Double> = 14...22
  var readerFontLabel = "Text size"
  /// The text size panel floats above the reader bar while this is set.
  var fontPanelPresented = false
  /// Bumped on each step of the text size slider, for its selection haptic.
  private(set) var fontStepFeedback = 0
  /// The link the share tool shares; without it the share tool is a plain press.
  var shareURL: String?
  /// The system share sheet is up. It is a SwiftUI sheet the bar presents itself, zooming out of the
  /// capsule, rather than something presented over it.
  var sharePresented = false
  var activeTint = Color.accentColor
  /// Bumped by a press that commits something worth feeling: switching tabs, or adding. Re-tapping
  /// the current tab, search and the switcher stay silent, as the system tab bar does. The bar plays
  /// the haptic from it with `sensoryFeedback`, on the frame the press lands.
  private(set) var pressFeedback = 0

  /// Frames of the capsule and the search button in the bar's coordinate
  /// space. Touches anywhere else pass through to the content underneath,
  /// except while the switcher sheet is open: it and its dimming take them all.
  /// `onGeometryChange` writes them every frame of a morph, and only hit
  /// testing reads them, so they are not observed.
  @ObservationIgnored var mainFrame = CGRect.zero
  @ObservationIgnored var actionFrame = CGRect.zero
  @ObservationIgnored var addFrame = CGRect.zero

  @ObservationIgnored var onTabPress: @MainActor (Int) -> Void = { _ in }
  @ObservationIgnored var onComposerActiveChange: @MainActor (Bool) -> Void = { _ in }
  @ObservationIgnored var onComposerQueryChange: @MainActor (String) -> Void = { _ in }
  @ObservationIgnored var onComposerSubmit: @MainActor (String, String, String) -> Void = { _, _, _ in }
  /// A reader tool other than the text size tool, which opens the panel natively.
  @ObservationIgnored var onReaderToolPress: @MainActor (String) -> Void = { _ in }
  /// Each step of the text size slider (`committed` false) and its release (`committed` true).
  @ObservationIgnored var onReaderFontSizeChange: @MainActor (Int, Bool) -> Void = { _, _ in }
  /// The slider is held: JavaScript's echo of the size must not move it under the finger.
  @ObservationIgnored private var fontSizeEditing = false
  /// When the slider last changed the size. JavaScript echoes each step back a beat later, and an
  /// echo that lands after the release (or after the next drag has begun) is older than the slider.
  @ObservationIgnored private var fontSizeChangedAt = Date.distantPast
  @ObservationIgnored var onSearchActiveChange: @MainActor (Bool) -> Void = { _ in }
  @ObservationIgnored var onSearchQueryChange: @MainActor (String) -> Void = { _ in }
  @ObservationIgnored var onSearchSubmit: @MainActor (String) -> Void = { _ in }
  /// What was done to a folder in the sheet: `open`, `create`, `rename` or `delete`, with the folder's
  /// id (empty for `create`) and its name (empty for `open` and `delete`).
  @ObservationIgnored var onSwitcherFolderAction: @MainActor (String, String, String) -> Void = { _, _, _ in }
  /// Lets the native view keep VoiceOver inside the open sheet.
  @ObservationIgnored var onSwitcherPresentedChange: @MainActor (Bool) -> Void = { _ in }

  /// Reports every press, including one on the selected tab, so JavaScript can
  /// emit `tabPress` the way a navigator's own tab bar does.
  func select(_ index: Int) {
    guard tabs.indices.contains(index) else { return }
    if selectedIndex != index {
      pressFeedback += 1
      selectedIndex = index
    }
    onTabPress(index)
  }

  /// How long after a slider change a different size from JavaScript is taken for a stale echo.
  private static let fontSizeEchoWindow: TimeInterval = 0.4

  var readerActive: Bool { !readerTools.isEmpty }

  func applyReader(_ state: ReaderState?) {
    guard let state else {
      if readerActive { readerTools = [] }
      if fontPanelPresented { fontPanelPresented = false }
      shareURL = nil
      sharePresented = false
      return
    }
    readerTools = state.tools
    shareURL = state.shareURL
    readerFontRange = state.fontRange
    readerFontLabel = state.fontLabel
    // One value path: the slider owns the size while held, JavaScript's echo is applied after.
    if !fontSizeEditing, readerFontSize != state.fontSize,
      Date().timeIntervalSince(fontSizeChangedAt) > Self.fontSizeEchoWindow
    {
      readerFontSize = state.fontSize
    }
  }

  func pressReaderTool(_ id: String) {
    pressFeedback += 1
    if id == "share", shareURL != nil {
      fontPanelPresented = false
      sharePresented = true
      return
    }
    if id == "textSize" {
      fontPanelPresented.toggle()
    } else {
      fontPanelPresented = false
      onReaderToolPress(id)
    }
  }

  func setReaderFontSize(_ value: Double) {
    let size = min(readerFontRange.upperBound, max(readerFontRange.lowerBound, value.rounded()))
    guard size != readerFontSize else { return }
    readerFontSize = size
    fontSizeChangedAt = Date()
    fontStepFeedback += 1
    onReaderFontSizeChange(Int(size), false)
  }

  func setFontSizeEditing(_ editing: Bool) {
    fontSizeEditing = editing
    fontSizeChangedAt = Date()
    if !editing { onReaderFontSizeChange(Int(readerFontSize), true) }
  }

  func toggleComposer() {
    pressFeedback += 1
    composerActive.toggle()
    if !composerActive {
      composerQuery = ""
    }
    onComposerActiveChange(composerActive)
  }

  func canSubmitComposer(_ feed: ComposerFeed) -> Bool {
    composerStatus != .submitting && !feed.isSubscribed
  }

  /// Follows or imports `feed` into `folderID`; the keyboard's return key, which names neither, acts
  /// on the first feed not yet followed, or on the typed address when nothing has been previewed.
  func submitComposer(_ feed: ComposerFeed? = nil, folderID: String? = nil) {
    guard composerStatus != .submitting else { return }
    if let target = feed ?? composerFeeds.first(where: { !$0.isSubscribed }) {
      guard !target.isSubscribed else { return }
      composerSubmittingID = target.id
      onComposerSubmit(target.feedID ?? "", target.url, folderID ?? "")
      return
    }
    let query = composerQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    guard composerKind == .import, !query.isEmpty, composerFeeds.isEmpty else { return }
    composerSubmittingID = nil
    onComposerSubmit("", query, "")
  }

  func toggleSearch() {
    searchActive.toggle()
    if !searchActive { searchQuery = "" }
    onSearchActiveChange(searchActive)
  }

  func submitSearch() {
    onSearchSubmit(searchQuery)
  }

  /// Constant-time: hit testing runs for every touch on the full-screen host.
  func isInteractive(at point: CGPoint) -> Bool {
    if switcherPresented { return true }
    // The composer's results and the screen behind them take every touch, so a tap outside closes it.
    if composerActive { return true }
    // The open text size panel takes every touch, so a tap outside closes it.
    if fontPanelPresented { return true }
    // The reader bar replaces the buttons, whose last frames are stale, so only it takes touches.
    if readerActive { return mainFrame.contains(point) }
    let mainShown = !minimized && !searchActive
    return (mainShown && mainFrame.contains(point))
      || actionFrame.contains(point)
      || addFrame.contains(point)
  }
}
