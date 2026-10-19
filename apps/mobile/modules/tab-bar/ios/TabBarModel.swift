import SwiftUI
import UIKit

struct TabBarItem: Identifiable {
  let id: String
  let label: String
  let icon: TabBarIcon
  let selectedIcon: TabBarIcon
}

struct TabBarSwitcher {
  let label: String
  let hint: String
  let icon: TabBarIcon
}

/// State shared between React Native props, the SwiftUI bar, and the events
/// sent back to JavaScript.
@MainActor
final class TabBarModel: ObservableObject {
  @Published var tabs: [TabBarItem] = []
  @Published var switcher: TabBarSwitcher?
  @Published var selectedIndex = 0
  @Published var minimized = false
  @Published var searchActive = false
  @Published var searchQuery = "" {
    didSet {
      if searchQuery != oldValue { onSearchQueryChange(searchQuery) }
    }
  }
  @Published var searchPlaceholder = "Search"
  @Published var activeTint = Color.accentColor

  /// Frames of the capsule and the search button in the bar's coordinate
  /// space. Touches anywhere else pass through to the content underneath.
  var mainFrame = CGRect.zero
  var actionFrame = CGRect.zero

  var onTabPress: @MainActor (Int) -> Void = { _ in }
  var onSwitcherPress: @MainActor () -> Void = {}
  var onSearchActiveChange: @MainActor (Bool) -> Void = { _ in }
  var onSearchQueryChange: @MainActor (String) -> Void = { _ in }
  var onSearchSubmit: @MainActor (String) -> Void = { _ in }

  private let feedback = UIImpactFeedbackGenerator(style: .light)

  /// Reports every press, including one on the selected tab, so JavaScript can
  /// emit `tabPress` the way a navigator's own tab bar does.
  func select(_ index: Int) {
    guard tabs.indices.contains(index) else { return }
    feedback.impactOccurred()
    if selectedIndex != index { selectedIndex = index }
    onTabPress(index)
  }

  func pressSwitcher() {
    feedback.impactOccurred()
    onSwitcherPress()
  }

  func toggleSearch() {
    feedback.impactOccurred()
    searchActive.toggle()
    if !searchActive { searchQuery = "" }
    onSearchActiveChange(searchActive)
  }

  func submitSearch() {
    onSearchSubmit(searchQuery)
  }

  func isInteractive(at point: CGPoint) -> Bool {
    mainFrame.contains(point) || actionFrame.contains(point)
  }
}
