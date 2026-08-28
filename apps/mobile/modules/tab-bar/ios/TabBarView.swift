import ExpoModulesCore
import ExpoUI
import SwiftUI
import UIKit

public struct TabBarView: ExpoSwiftUI.View {
  @ObservedObject public var props: TabBarProps

  @Environment(\.accessibilityReduceMotion)
  private var reduceMotion

  @FocusState
  var searchFocused: Bool

  @Namespace
  private var glassNamespace

  @State
  var searchText = ""

  public init(props: TabBarProps) {
    self.props = props
  }

  public var body: some View {
    GeometryReader { proxy in
      let layout = Layout(
        width: proxy.size.width,
        minimized: props.searchActive ? false : props.minimized
      )

      HStack(spacing: layout.gap) {
        Group {
          if props.searchActive {
            searchField(layout: layout)
              .frame(maxWidth: .infinity)
          } else {
            mainCapsule(layout: layout)
              .frame(width: layout.mainWidth)
          }
        }

        searchActionButton(layout: layout)
          .frame(width: layout.actionDiameter, height: layout.actionDiameter)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
      .padding(.horizontal, layout.horizontalPadding)
    }
    .animation(animation, value: props.activeTab)
    .animation(animation, value: props.minimized)
    .animation(animation, value: props.searchActive)
    .onChange(of: props.searchActive) { isActive in
      if isActive {
        DispatchQueue.main.async {
          searchFocused = true
        }
      } else {
        searchFocused = false
        searchText = ""
      }
    }
  }

  private var animation: Animation? {
    reduceMotion ? nil : .spring(response: 0.28, dampingFraction: 0.9)
  }

  // MARK: - Navigation

  @ViewBuilder
  func mainCapsule(layout: Layout) -> some View {
    ZStack(alignment: .leading) {
      if #available(iOS 26.0, *) {
        GlassEffectContainer {
          glassLayers(layout: layout)
        }
      } else {
        glassLayers(layout: layout)
      }

      navigationContents(layout: layout)
    }
    .frame(width: layout.mainWidth, height: layout.barHeight)
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Kyomi navigation")
  }

  private func glassLayers(layout: Layout) -> some View {
    ZStack(alignment: .leading) {
      Capsule()
        .fill(.clear)
        .frame(width: layout.mainWidth, height: layout.barHeight)
        .glassSurface(in: Capsule())
        .allowsHitTesting(false)
        .accessibilityHidden(true)

      selectionGlass(layout: layout)
        .offset(x: layout.selectionX(for: props.activeTab))
    }
    .frame(width: layout.mainWidth, height: layout.barHeight)
    .containerShape(.capsule)
  }

  func navigationContents(layout: Layout) -> some View {
    HStack(spacing: 0) {
      tabButton(
        title: "Feeds",
        activeImage: "board-fill",
        inactiveImage: "board-line",
        tab: "feeds",
        width: layout.regularWidth,
        iconSize: layout.tabIconSize
      )

      tabButton(
        title: "Explore",
        activeImage: "album-2-fill",
        inactiveImage: "album-2-line",
        tab: "explore",
        width: layout.regularWidth,
        iconSize: layout.tabIconSize
      )

      sourceMenu(layout: layout)
        .frame(width: layout.selectorWidth, height: Metrics.minimumTargetSize)
    }
    .padding(.horizontal, layout.contentPadding)
    .frame(width: layout.mainWidth, height: layout.barHeight)
  }

  @ViewBuilder
  func selectionGlass(layout: Layout) -> some View {
    if #available(iOS 26.0, *) {
      Capsule()
        .fill(.clear)
        .frame(width: layout.selectionWidth, height: layout.selectionHeight)
        .glassEffect(.clear, in: Capsule())
        .glassEffectID("selected-tab", in: glassNamespace)
        .glassEffectTransition(.matchedGeometry)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    } else {
      Capsule()
        .fill(.thinMaterial)
        .frame(width: layout.selectionWidth, height: layout.selectionHeight)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
  }

  func tabButton(
    title: String,
    activeImage: String,
    inactiveImage: String,
    tab: String,
    width: CGFloat,
    iconSize: CGFloat
  ) -> some View {
    let isActive = props.activeTab == tab

    return Button {
      haptic()
      props.onSelectTab(["tab": tab])
    } label: {
      Image(isActive ? activeImage : inactiveImage, bundle: .main)
        .resizable()
        .scaledToFit()
        .frame(width: iconSize, height: iconSize)
        .foregroundStyle(isActive ? Metrics.matcha : Color.primary.opacity(0.72))
        .frame(width: width, height: Metrics.minimumTargetSize)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(title == "Explore" ? "Explore articles" : title)
    .accessibilityAddTraits(isActive ? .isSelected : [])
  }

  func haptic() {
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
  }
}
