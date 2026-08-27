import ExpoModulesCore
import ExpoUI
import SwiftUI
import UIKit

public struct KyomiTabBarView: ExpoSwiftUI.View {
  @ObservedObject public var props: KyomiTabBarProps
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @FocusState private var searchFocused: Bool
  @State private var searchText = ""

  public init(props: KyomiTabBarProps) {
    self.props = props
  }

  public var body: some View {
    GeometryReader { proxy in
      let layout = Layout(
        width: proxy.size.width,
        minimized: props.searchActive ? false : props.minimized,
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

        searchActionButton
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

  private func mainCapsule(layout: Layout) -> some View {
    HStack(spacing: 0) {
      tabButton(
        title: "Feeds",
        activeImage: "board-fill",
        inactiveImage: "board-line",
        tab: "feeds",
        width: layout.regularWidth,
      )
      tabButton(
        title: "All",
        activeImage: "album-2-fill",
        inactiveImage: "album-2-line",
        tab: "all",
        width: layout.regularWidth,
      )
      sourceMenu(layout: layout)
        .frame(width: layout.selectorWidth, height: Metrics.minimumTargetSize)
    }
    .padding(.horizontal, layout.contentPadding)
    .frame(width: layout.mainWidth, height: layout.barHeight)
    .glassSurface(in: Capsule())
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Kyomi navigation")
  }

  private func tabButton(
    title: String,
    activeImage: String,
    inactiveImage: String,
    tab: String,
    width: CGFloat,
  ) -> some View {
    let isActive = props.activeTab == tab

    return Button {
      haptic()
      props.onSelectTab(["tab": tab])
    } label: {
      Image(isActive ? activeImage : inactiveImage, bundle: .main)
        .resizable()
        .scaledToFit()
        .frame(width: Metrics.tabIconSize, height: Metrics.tabIconSize)
        .foregroundStyle(isActive ? Color.accentColor : Color.primary.opacity(0.72))
        .frame(width: width, height: Metrics.minimumTargetSize)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(title == "All" ? "All articles" : title)
    .accessibilityAddTraits(isActive ? .isSelected : [])
  }

  private func sourceMenu(layout: Layout) -> some View {
    Menu {
      let folders = props.sources.filter { $0.kind == "folder" }
      let feeds = props.sources.filter { $0.kind == "feed" }

      if !folders.isEmpty {
        Section("Folders") {
          ForEach(folders, id: \.id) { source in
            sourceButton(source)
          }
        }
      }

      if !feeds.isEmpty {
        Section("Feeds") {
          ForEach(feeds, id: \.id) { source in
            sourceButton(source)
          }
        }
      }

      if folders.isEmpty && feeds.isEmpty {
        Text("No sources available")
      }
    } label: {
      Image("selector-line", bundle: .main)
        .resizable()
        .scaledToFit()
        .frame(width: Metrics.selectorIconSize, height: Metrics.selectorIconSize)
        .foregroundStyle(Color.primary.opacity(0.72))
        .frame(width: layout.selectorWidth, height: Metrics.minimumTargetSize)
        .contentShape(Rectangle().inset(by: -4))
    }
    .menuStyle(.automatic)
    .buttonStyle(.plain)
    .foregroundStyle(Color.primary.opacity(0.72))
    .accessibilityLabel("Choose source")
    .accessibilityHint("Opens folders and feeds")
  }

  private func sourceButton(_ source: KyomiSource) -> some View {
    Button {
      haptic()
      props.onSelectSource(["id": source.id, "kind": source.kind])
    } label: {
      HStack {
        Label {
          Text(source.title)
        } icon: {
          Image(systemName: source.kind == "folder" ? "folder" : "dot.radiowaves.left.and.right")
        }

        if props.selectedSourceId == source.id {
          Image(systemName: "checkmark")
        }
      }
    }
  }

  private func searchField(layout: Layout) -> some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass")
        .font(.system(size: 17, weight: .medium))
        .foregroundStyle(.secondary)

      TextField("Search feeds or articles", text: $searchText)
        .focused($searchFocused)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .submitLabel(.search)
        .foregroundStyle(Color.primary)
        .accessibilityLabel("Search feeds or articles")
        .onSubmit {
          props.onSearchSubmit(["query": searchText])
        }
    }
    .padding(.horizontal, 14)
    .frame(height: layout.barHeight)
    .glassSurface(in: Capsule())
    .onChange(of: searchText) { value in
      props.onSearchQueryChange(["query": value])
    }
  }

  private var searchActionButton: some View {
    Button {
      haptic()

      if props.searchActive {
        searchFocused = false
        searchText = ""
        props.onSearchClose([:])
      } else {
        props.onSearchPress([:])
      }
    } label: {
      Image(systemName: props.searchActive ? "xmark" : "magnifyingglass")
        .font(.system(size: props.searchActive ? 16 : 18, weight: .semibold))
        .foregroundStyle(Color.primary.opacity(0.82))
        .contentTransition(.symbolEffect(.replace))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .glassSurface(in: Circle())
    .accessibilityLabel(props.searchActive ? "Close search" : "Search")
    .accessibilityHint(props.searchActive ? "Closes search" : "Opens search")
  }

  private func haptic() {
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
  }
}

private enum Metrics {
  static let horizontalPadding: CGFloat = 16
  static let gap: CGFloat = 10
  static let contentPadding: CGFloat = 4
  static let selectorRatio: CGFloat = 0.6
  static let normalBarHeight: CGFloat = 48
  static let compactBarHeight: CGFloat = 44
  static let normalMainWidth: CGFloat = 168
  static let compactMainWidth: CGFloat = 150
  static let tabIconSize: CGFloat = 25
  static let selectorIconScale: CGFloat = 0.8
  static let minimumTargetSize: CGFloat = 44

  static var selectorIconSize: CGFloat {
    tabIconSize * selectorIconScale
  }
}

private struct Layout {
  let horizontalPadding = Metrics.horizontalPadding
  let gap = Metrics.gap
  let contentPadding = Metrics.contentPadding
  let actionDiameter: CGFloat
  let barHeight: CGFloat
  let regularWidth: CGFloat
  let selectorWidth: CGFloat
  let mainWidth: CGFloat

  init(width: CGFloat, minimized: Bool) {
    actionDiameter = minimized ? Metrics.compactBarHeight : Metrics.normalBarHeight
    barHeight = minimized ? Metrics.compactBarHeight : Metrics.normalBarHeight

    let availableWidth = max(0, width - (horizontalPadding * 2))
    let maximumMainWidth = max(0, availableWidth - gap - actionDiameter)
    let preferredMainWidth = minimized ? Metrics.compactMainWidth : Metrics.normalMainWidth
    mainWidth = min(preferredMainWidth, maximumMainWidth)

    let usableWidth = max(0, mainWidth - (contentPadding * 2))
    regularWidth = usableWidth / (2 + Metrics.selectorRatio)
    selectorWidth = regularWidth * Metrics.selectorRatio
  }
}

private extension View {
  @ViewBuilder
  func glassSurface<S: Shape>(in shape: S) -> some View {
    if #available(iOS 26.0, *) {
      glassEffect(.regular.interactive(), in: shape)
    } else {
      background(.ultraThinMaterial, in: shape)
        .overlay(shape.stroke(Color.white.opacity(0.14), lineWidth: 1))
    }
  }
}
