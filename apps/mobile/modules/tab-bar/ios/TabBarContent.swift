import SwiftUI
import UIKit

/// Kyomi's floating tab bar: a Liquid Glass capsule holding the tabs and the
/// narrower switcher, and a separate search button that turns the capsule
/// into a search field.
struct TabBarContent: View {
  @ObservedObject var model: TabBarModel
  @FocusState private var searchFocused: Bool
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private nonisolated static let coordinateSpace = "KyomiTabBar"
  private static let inactiveIconColor = Color.primary.opacity(0.72)
  private static let actionIconColor = Color.primary.opacity(0.82)
  private static let searchFieldIconColor = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 0x98 / 255, green: 0x98 / 255, blue: 0x9D / 255, alpha: 1)
        : UIColor(red: 0x8E / 255, green: 0x8E / 255, blue: 0x93 / 255, alpha: 1)
    }
  )

  private var transition: Animation {
    reduceMotion ? .easeOut(duration: 0.16) : .spring(duration: 0.45, bounce: 0.08)
  }

  var body: some View {
    GeometryReader { proxy in
      let layout = TabBarLayout(
        containerWidth: proxy.size.width,
        tabCount: model.tabs.count,
        hasSwitcher: model.switcher != nil,
        minimized: model.minimized,
        searchActive: model.searchActive
      )

      GlassEffectContainer(spacing: 0) {
        HStack(spacing: TabBarMetrics.gap) {
          capsule(layout)
          actionButton(layout)
        }
      }
      // Hold the bar in a band as tall as the expanded capsule so a minimized
      // bar shrinks around its center, as the system tab bar does.
      .frame(width: proxy.size.width, height: TabBarMetrics.height)
    }
    .coordinateSpace(.named(Self.coordinateSpace))
    .animation(transition, value: model.minimized)
    .animation(transition, value: model.searchActive)
    .onChange(of: model.searchActive) { _, active in
      if !active { searchFocused = false }
    }
    .accessibilityElement(children: .contain)
    .accessibilityAddTraits(.isTabBar)
  }

  private func capsule(_ layout: TabBarLayout) -> some View {
    ZStack {
      tabs(layout)
        .opacity(model.searchActive ? 0 : 1)
        .allowsHitTesting(!model.searchActive)
        .accessibilityHidden(model.searchActive)

      if model.searchActive {
        searchField(layout)
          .transition(.opacity)
      }
    }
    .frame(width: layout.mainWidth, height: layout.barHeight)
    .glassEffect(.regular.interactive(), in: .capsule)
    .onGeometryChange(for: CGRect.self) { proxy in
      proxy.frame(in: .named(Self.coordinateSpace))
    } action: { frame in
      model.mainFrame = frame
    }
  }

  private func tabs(_ layout: TabBarLayout) -> some View {
    let switcherIndex = model.tabs.count

    return ZStack {
      // Behind the control: its switcher segment ignores touches, so a tap
      // there reaches this button instead of moving the selection.
      HStack(spacing: 0) {
        Color.clear
          .frame(width: layout.segmentWidths.prefix(switcherIndex).reduce(0, +))
          .allowsHitTesting(false)
        if let switcher = model.switcher, layout.segmentWidths.indices.contains(switcherIndex) {
          switcherButton(switcher, width: layout.segmentWidths[switcherIndex], layout: layout)
        }
      }

      TabSelector(
        segmentWidths: layout.segmentWidths,
        height: layout.segmentHeight,
        selectedIndex: model.selectedIndex,
        deadIndices: model.switcher == nil ? [] : [switcherIndex],
        onSelect: { model.select($0) }
      )
      .accessibilityHidden(true)

      HStack(spacing: 0) {
        ForEach(Array(model.tabs.enumerated()), id: \.element.id) { index, tab in
          let isSelected = index == model.selectedIndex
          TabBarIconView(
            icon: isSelected ? tab.selectedIcon : tab.icon,
            size: TabBarMetrics.tabIconSize * layout.iconScale,
            color: isSelected ? model.activeTint : Self.inactiveIconColor
          )
          .frame(width: layout.segmentWidths[index], height: layout.segmentHeight)
          .accessibilityElement()
          .accessibilityLabel(tab.label)
          .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
          .accessibilityAction { model.select(index) }
        }
        if model.switcher != nil, layout.segmentWidths.indices.contains(switcherIndex) {
          Color.clear.frame(width: layout.segmentWidths[switcherIndex])
        }
      }
      .allowsHitTesting(false)
    }
    .frame(width: layout.segmentsWidth, height: layout.segmentHeight)
  }

  private func switcherButton(_ switcher: TabBarSwitcher, width: CGFloat, layout: TabBarLayout) -> some View {
    Button {
      model.pressSwitcher()
    } label: {
      TabBarIconView(
        icon: switcher.icon,
        size: TabBarMetrics.switcherIconSize * layout.iconScale,
        color: Self.inactiveIconColor
      )
      .frame(width: width, height: layout.segmentHeight)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(switcher.label)
    .accessibilityHint(switcher.hint)
  }

  private func searchField(_ layout: TabBarLayout) -> some View {
    HStack(spacing: TabBarMetrics.searchFieldSpacing) {
      searchGlyph(size: TabBarMetrics.searchIconSize, color: Self.searchFieldIconColor)
        .frame(width: TabBarMetrics.searchFieldIconWidth)
        .accessibilityHidden(true)

      TextField(model.searchPlaceholder, text: $model.searchQuery)
        .focused($searchFocused)
        .submitLabel(.search)
        .onSubmit {
          model.submitSearch()
          searchFocused = false
        }
        .onAppear { searchFocused = true }
    }
    .padding(.horizontal, TabBarMetrics.searchFieldPadding)
    .frame(width: layout.mainWidth, height: layout.barHeight)
  }

  @ViewBuilder
  private func searchGlyph(size: CGFloat, color: Color) -> some View {
    if let icon = model.searchIcon {
      TabBarIconView(icon: icon, size: size, color: color)
    } else {
      Image(systemName: "magnifyingglass")
        .font(.system(size: size))
        .foregroundStyle(color)
    }
  }

  private func actionButton(_ layout: TabBarLayout) -> some View {
    Button {
      model.toggleSearch()
    } label: {
      Group {
        if model.searchActive {
          Image(systemName: "xmark")
            .font(.system(size: TabBarMetrics.closeIconSize * layout.iconScale))
            .foregroundStyle(Self.actionIconColor)
        } else {
          searchGlyph(size: TabBarMetrics.searchIconSize * layout.iconScale, color: Self.actionIconColor)
        }
      }
      .frame(width: layout.actionSize, height: layout.actionSize)
      .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.interactive(), in: .circle)
    .accessibilityLabel(model.searchActive ? "Close search" : "Search")
    .onGeometryChange(for: CGRect.self) { proxy in
      proxy.frame(in: .named(Self.coordinateSpace))
    } action: { frame in
      model.actionFrame = frame
    }
  }
}
