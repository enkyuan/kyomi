import SwiftUI

extension TabBarView {
  // MARK: - Sources

  func sourceMenu(
    layout: Layout
  ) -> some View {
    Menu {
      let folders =
        props.sources.filter {
          $0.kind == "folder"
        }

      let feeds =
        props.sources.filter {
          $0.kind == "feed"
        }

      if !folders.isEmpty {
        Section("Folders") {
          ForEach(
            folders,
            id: \.id
          ) { source in
            sourceButton(source)
          }
        }
      }

      if !feeds.isEmpty {
        Section("Feeds") {
          ForEach(
            feeds,
            id: \.id
          ) { source in
            sourceButton(source)
          }
        }
      }

      if folders.isEmpty && feeds.isEmpty {
        Text("No sources available")
      }
    } label: {
      Image(
        "selector-line",
        bundle: .main
      )
      .resizable()
      .scaledToFit()
      .frame(
        width: layout.selectorIconSize,
        height: layout.selectorIconSize
      )
      .foregroundStyle(
        Color.primary.opacity(0.72)
      )
      .frame(
        width: layout.selectorWidth,
        height: Metrics.minimumTargetSize
      )
      .contentShape(
        Rectangle()
          .inset(by: -6)
      )
    }
    .menuStyle(.automatic)
    .buttonStyle(.plain)
    .foregroundStyle(
      Color.primary.opacity(0.72)
    )
    .accessibilityLabel(
      "Choose source"
    )
    .accessibilityHint(
      "Opens folders and feeds"
    )
  }

  func sourceButton(
    _ source: KyomiSource
  ) -> some View {
    Button {
      haptic()

      props.onSelectSource([
        "id": source.id,
        "kind": source.kind,
      ])
    } label: {
      HStack {
        Label {
          Text(source.title)
        } icon: {
          Image(
            systemName:
              source.kind == "folder"
              ? "folder"
              : "dot.radiowaves.left.and.right"
          )
        }

        if props.selectedSourceId
          == source.id
        {
          Image(
            systemName: "checkmark"
          )
        }
      }
    }
  }
}
