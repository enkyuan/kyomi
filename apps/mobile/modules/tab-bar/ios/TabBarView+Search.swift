import SwiftUI

extension TabBarView {
  // MARK: - Search

  func searchField(
    layout: Layout
  ) -> some View {
    HStack(spacing: 8) {
      Image(
        systemName: "magnifyingglass"
      )
      .font(
        .system(
          size: layout.searchIconSize,
          weight: .medium
        )
      )
      .foregroundStyle(.secondary)

      TextField(
        "Search feeds or articles",
        text: $searchText
      )
      .focused($searchFocused)
      .textInputAutocapitalization(.never)
      .autocorrectionDisabled()
      .submitLabel(.search)
      .foregroundStyle(Color.primary)
      .accessibilityLabel(
        "Search feeds or articles"
      )
      .onSubmit {
        props.onSearchSubmit([
          "query": searchText
        ])
      }
    }
    .padding(.horizontal, 14)
    .frame(height: layout.barHeight)
    .glassSurface(in: Capsule())
    .onChange(of: searchText) { value in
      props.onSearchQueryChange([
        "query": value
      ])
    }
  }

  func searchActionButton(
    layout: Layout
  ) -> some View {
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
      Image(
        systemName:
          props.searchActive
          ? "xmark"
          : "magnifyingglass"
      )
      .font(
        .system(
          size:
            props.searchActive
            ? layout.closeIconSize
            : layout.searchIconSize,
          weight: .semibold
        )
      )
      .foregroundStyle(
        Color.primary.opacity(0.82)
      )
      .contentTransition(
        .symbolEffect(.replace)
      )
      .frame(
        maxWidth: .infinity,
        maxHeight: .infinity
      )
      .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .glassSurface(in: Circle())
    .accessibilityLabel(
      props.searchActive
        ? "Close search"
        : "Search"
    )
    .accessibilityHint(
      props.searchActive
        ? "Closes search"
        : "Opens search"
    )
  }
}
