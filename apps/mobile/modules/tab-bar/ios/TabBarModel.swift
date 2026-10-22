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
  @ObservationIgnored var onAddPress: @MainActor () -> Void = {}
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


  func pressAdd() {
    pressFeedback += 1
    onAddPress()
  }

  func pressAdd() {
    feedback.impactOccurred()
    onAddPress()
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
    let mainShown = !minimized || searchActive
    return (mainShown && mainFrame.contains(point))
      || (!searchActive && actionFrame.contains(point))
      || addFrame.contains(point)
  }
}
