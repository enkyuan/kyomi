import SwiftUI
import UIKit

/// Kyomi's floating tab bar, laid out like the iOS 26 system bar: a search button at the leading
/// edge, a Liquid Glass capsule of tabs and the narrower switcher centred between the buttons, and
/// a matcha add button at the trailing edge. Searching turns the capsule into a search field;
/// minimizing hides the capsule and leaves only the two buttons.
struct TabBarContent: View {
  @ObservedObject var model: TabBarModel
  @FocusState private var searchFocused: Bool
  /// Ties each glass shape to an identity so a hidden one materializes in and out, as the
  /// system tab bar's glass does, instead of fading its content over a stuck glass layer.
  @Namespace private var glassNamespace
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
      let centerY = TabBarMetrics.height / 2

      // One container so the glass shapes render together and morph as they move.
      GlassEffectContainer(spacing: 0) {
        ZStack(alignment: .topLeading) {
          if layout.showsMain {
            capsule(layout)
              .glassEffectID("capsule", in: glassNamespace)
              .glassEffectTransition(.materialize)
              .position(x: layout.mainX + layout.mainWidth / 2, y: centerY)
              .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .named(Self.coordinateSpace))
              } action: { frame in
                model.mainFrame = frame
              }
          }

          if layout.showsSearchButton {
            searchButton(layout)
              .glassEffectID("search", in: glassNamespace)
              .glassEffectTransition(.materialize)
              .position(x: layout.searchX + layout.buttonSize / 2, y: centerY)
              .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .named(Self.coordinateSpace))
              } action: { frame in
                model.actionFrame = frame
              }
          }

          // The add button and the close button share one glass identity, so the trailing
          // button morphs between them as search opens and closes.
          Group {
            if layout.showsAdd {
              addButton(layout)
            } else {
              closeButton(layout)
            }
          }
          .glassEffectID("trailing", in: glassNamespace)
          .glassEffectTransition(.materialize)
          .position(x: layout.addX + layout.buttonSize / 2, y: centerY)
          .onGeometryChange(for: CGRect.self) { proxy in
            proxy.frame(in: .named(Self.coordinateSpace))
          } action: { frame in
            model.addFrame = frame
          }
        }
      }
      // Hold the bar in a band as tall as the expanded capsule so the minimized buttons
      // shrink around their centres.
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
            size: TabBarMetrics.tabIconSize,
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
        size: TabBarMetrics.switcherIconSize,
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

  private func searchButton(_ layout: TabBarLayout) -> some View {
    Button {
      model.toggleSearch()
    } label: {
      searchGlyph(
        size: TabBarMetrics.searchIconSize * layout.buttonScale,
        color: Self.actionIconColor
      )
      .frame(width: layout.buttonSize, height: layout.buttonSize)
      .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.interactive(), in: .circle)
    .accessibilityLabel("Search articles")
  }

  private func closeButton(_ layout: TabBarLayout) -> some View {
    Button {
      model.toggleSearch()
    } label: {
      Image(systemName: "xmark")
        .font(.system(size: TabBarMetrics.closeIconSize * layout.buttonScale))
        .foregroundStyle(Self.actionIconColor)
        .frame(width: layout.buttonSize, height: layout.buttonSize)
        .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.interactive(), in: .circle)
    .accessibilityLabel("Close search")
  }

  private func addButton(_ layout: TabBarLayout) -> some View {
    Button {
      model.pressAdd()
    } label: {
      Group {
        if let icon = model.addIcon {
          TabBarIconView(
            icon: icon,
            size: TabBarMetrics.addIconSize * layout.buttonScale,
            color: model.addIconColor
          )
        } else {
          Image(systemName: "plus")
            .font(.system(size: TabBarMetrics.addIconSize * layout.buttonScale, weight: .semibold))
            .foregroundStyle(model.addIconColor)
        }
      }
      .frame(width: layout.buttonSize, height: layout.buttonSize)
      .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.tint(model.activeTint).interactive(), in: .circle)
    .accessibilityLabel("Add")
  }
}
