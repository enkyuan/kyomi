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

/// State shared between React Native props, the SwiftUI bar, and the events
/// sent back to JavaScript. Observation tracks each property separately, so a
/// view re-renders only for what it reads: typing a search query redraws the
/// field, not the whole bar.
@MainActor
@Observable
final class TabBarModel {
  var tabs: [TabBarItem] = []
  var switcher: TabBarSwitcher?
  /// Magnifying glass drawn in the search button and field; falls back to the SF Symbol.
  var searchIcon: TabBarIcon?
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
  /// The add composer: the add button's glass grown into a card that takes a feed address to
  /// import or words to search for, with the folder to file the feed in.
  var composerActive = false
  var composerQuery = "" {
    didSet {
      if composerQuery != oldValue { onComposerQueryChange(composerQuery) }
    }
  }
  var composerKind = ComposerKind.follow
  var composerFeeds: [ComposerFeed] = [] {
    didSet {
      if !composerFeeds.contains(where: { $0.id == composerSelection }) {
        composerSelection = composerFeeds.first(where: { !$0.isSubscribed })?.id ?? composerFeeds.first?.id
      }
    }
  }
  var composerFolders: [ComposerFolder] = []
  var composerMessage: String?
  var composerStatus = ComposerStatus.idle {
    didSet {
      if composerStatus == .done, composerActive { toggleComposer() }
    }
  }
  /// The feed Follow acts on; Import always acts on the one previewed.
  var composerSelection: String?
  /// The folder the feed is filed in; nil leaves it unsorted.
  var composerFolderID: String?
  var searchPlaceholder = "Search"
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
  @ObservationIgnored var onSearchActiveChange: @MainActor (Bool) -> Void = { _ in }
  @ObservationIgnored var onSearchQueryChange: @MainActor (String) -> Void = { _ in }
  @ObservationIgnored var onSearchSubmit: @MainActor (String) -> Void = { _ in }
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

  func toggleComposer() {
    pressFeedback += 1
    composerActive.toggle()
    if !composerActive {
      composerQuery = ""
      composerFolderID = nil
    }
    onComposerActiveChange(composerActive)
  }

  /// Rows the card lists: the feeds found, or one line of message when there are none.
  var composerListedRows: Int {
    composerFeeds.isEmpty ? (composerMessage == nil ? 0 : 1) : composerFeeds.count
  }

  /// The feed the primary button acts on, if it can act yet.
  var composerTarget: ComposerFeed? {
    composerFeeds.first { $0.id == composerSelection } ?? composerFeeds.first
  }

  var composerCanSubmit: Bool {
    guard composerStatus != .submitting else { return false }
    let query = composerQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    switch composerKind {
    case .import: return !query.isEmpty
    case .follow: return composerTarget.map { !$0.isSubscribed } ?? false
    }
  }

  func submitComposer() {
    guard composerCanSubmit else { return }
    let feed = composerKind == .import ? composerFeeds.first : composerTarget
    onComposerSubmit(feed?.feedID ?? "", feed?.url ?? composerQuery, composerFolderID ?? "")
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
    let mainShown = !minimized && !searchActive
    return (mainShown && mainFrame.contains(point))
      || actionFrame.contains(point)
      || addFrame.contains(point)
  }
}
