import SwiftUI

/// The add composer: a layer over the whole screen, the bar included, that brings its own
/// background, search field and close button, so the bar underneath is never touched. The feeds
/// found list above the field, each with one button that follows or imports it, asking which folder
/// to file it in when there are folders. Tapping the background outside the list closes it.
struct TabBarComposer: View {
  @Bindable var model: TabBarModel
  var focused: Binding<Bool>
  let container: CGSize
  /// The bar's layout as if searching, whose field and close button this layer draws.
  let fieldLayout: TabBarLayout
  /// Where the status bar ends; the list stops a gap below it.
  let safeTop: CGFloat

  /// The mobile theme's `--background`, so the list sits on the same ground as the screens it covers.
  private static let background = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 0x16 / 255, green: 0x16 / 255, blue: 0x16 / 255, alpha: 1)
        : UIColor(red: 0xF7 / 255, green: 0xF5 / 255, blue: 0xF1 / 255, alpha: 1)
    }
  )
  private static let glyphColor = Color(uiColor: .secondaryLabel)

  private var field: CGRect { fieldLayout.searchRect }
  private var close: CGRect { fieldLayout.trailingRect }
  /// The list ends a gap above the field and starts a gap below the status bar.
  private var listBottom: CGFloat { field.minY - TabBarMetrics.composerResultsGap }
  private var listHeight: CGFloat { max(0, listBottom - safeTop - TabBarMetrics.composerResultsGap) }

  var body: some View {
    ZStack(alignment: .topLeading) {
      Self.background
        .contentShape(.rect)
        .onTapGesture { model.toggleComposer() }
        .accessibilityHidden(true)

      results
        .frame(width: container.width, height: listBottom, alignment: .bottom)

      GlassEffectContainer(spacing: 0) {
        fieldView
          .position(x: field.midX, y: field.midY)
        closeButton
          .position(x: close.midX, y: close.midY)
      }
    }
    .frame(width: container.width, height: container.height)
    .animation(.easeOut(duration: 0.2), value: model.composerFeeds)
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Add a feed")
    .accessibilityAddTraits(.isModal)
    .accessibilityAction(.escape) { model.toggleComposer() }
  }

  // MARK: Field

  private var fieldView: some View {
    HStack(spacing: 8) {
      TabBarField(
        text: $model.composerQuery,
        focused: focused,
        placeholder: "Search or paste a URL",
        returnKey: .go,
        keyboard: .webSearch
      ) {
        model.submitComposer()
      }
      if model.composerStatus == .loading {
        ProgressView()
      }
    }
    .padding(.leading, TabBarMetrics.fieldTextInset)
    .padding(.trailing, TabBarMetrics.fieldTextTrailing)
    .frame(width: field.width, height: field.height, alignment: .leading)
    .overlay(alignment: .leading) {
      glyph
        .frame(width: field.height, height: field.height)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
    .clipShape(.capsule)
    .glassEffect(.regular, in: .capsule)
  }

  @ViewBuilder
  private var glyph: some View {
    if let icon = model.composerIcon {
      TabBarIconView(icon: icon, size: TabBarMetrics.fieldIconSize, color: Self.glyphColor)
    } else {
      Image(systemName: "magnifyingglass")
        .font(.system(size: TabBarMetrics.fieldIconSize))
        .foregroundStyle(Self.glyphColor)
    }
  }

  private var closeButton: some View {
    Button {
      model.toggleComposer()
    } label: {
      Image(systemName: "xmark")
        .font(.system(size: 17, weight: .semibold))
        .foregroundStyle(.primary.opacity(0.82))
        .frame(width: close.width, height: close.height)
        .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.interactive(), in: .circle)
    .accessibilityLabel("Close")
  }

  // MARK: Results

  @ViewBuilder
  private var results: some View {
    if model.composerFeeds.isEmpty {
      emptyState
    } else {
      // Whole rows only: a row cut by the list's top edge at rest would read as running under the
      // status bar. Scrolled rows still leave through that edge, fading out as they go.
      let fitting = max(1, Int(listHeight / TabBarMetrics.composerResultHeight))
      let rows = min(model.composerFeeds.count, fitting)
      ScrollView {
        LazyVStack(spacing: 0) {
          ForEach(model.composerFeeds) { feed in
            row(feed)
          }
        }
        .padding(.horizontal, TabBarMetrics.edgeInset)
      }
      .scrollIndicators(.hidden)
      .scrollBounceBehavior(.basedOnSize)
      .defaultScrollAnchor(.bottom)
      .mask(
        VStack(spacing: 0) {
          LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom).frame(height: 16)
          Color.black
        }
      )
      .frame(height: CGFloat(rows) * TabBarMetrics.composerResultHeight)
    }
  }

  /// Before anything is typed, a hint; after, why nothing is listed. Nothing while a search is
  /// still under way, when the field shows its spinner.
  @ViewBuilder
  private var emptyState: some View {
    let query = model.composerQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    Group {
      if query.isEmpty {
        TabBarEmptyState(title: "Add a feed", description: "Search by topic or paste a feed address.")
      } else if model.composerStatus == .failed, let message = model.composerMessage {
        TabBarEmptyState(title: "Something went wrong", description: message)
      } else if model.composerStatus != .loading, model.composerMessage != nil {
        TabBarEmptyState(title: "No feeds found", description: "Try another topic or paste a feed address.")
      }
    }
    .frame(maxWidth: .infinity)
    .frame(height: listHeight)
  }

  private func row(_ feed: ComposerFeed) -> some View {
    HStack(spacing: 12) {
      AsyncImage(url: feed.faviconURL) { image in
        image.resizable().scaledToFit()
      } placeholder: {
        Image(systemName: "dot.radiowaves.up.forward").foregroundStyle(.secondary)
      }
      .frame(width: 36, height: 36)
      .clipShape(.rect(cornerRadius: 8))

      VStack(alignment: .leading, spacing: 2) {
        Text(feed.title).font(.subheadline.weight(.semibold)).lineLimit(1)
        Text(feed.detail ?? feed.url).font(.caption).foregroundStyle(.secondary).lineLimit(1)
      }
      Spacer(minLength: 0)

      if feed.isSubscribed {
        Text("Following").font(.footnote).foregroundStyle(.secondary)
      } else {
        action(feed)
      }
    }
    .frame(height: TabBarMetrics.composerResultHeight)
  }

  /// With folders, pressing the button lists them to file the feed in; without, it follows at once.
  @ViewBuilder
  private func action(_ feed: ComposerFeed) -> some View {
    if model.composerFolders.isEmpty {
      Button {
        model.submitComposer(feed)
      } label: {
        actionLabel(feed)
      }
      .buttonStyle(.plain)
      .disabled(!model.canSubmitComposer(feed))
    } else {
      Menu {
        Button("Unsorted", systemImage: "tray") { model.submitComposer(feed) }
        ForEach(model.composerFolders) { folder in
          Button(folder.name, systemImage: "folder") { model.submitComposer(feed, folderID: folder.id) }
        }
      } label: {
        actionLabel(feed)
      }
      .buttonStyle(.plain)
      .disabled(!model.canSubmitComposer(feed))
    }
  }

  private func actionLabel(_ feed: ComposerFeed) -> some View {
    let submitting = model.composerStatus == .submitting && model.composerSubmittingID == feed.id
    return ZStack {
      Text(model.composerKind == .import ? "Import" : "Follow")
        .opacity(submitting ? 0 : 1)
      if submitting {
        ProgressView().tint(model.addIconColor)
      }
    }
    .font(.system(size: 15, weight: .semibold))
    .foregroundStyle(model.addIconColor)
    .padding(.horizontal, 18)
    .frame(height: 36)
    .background(model.activeTint, in: .capsule)
    .opacity(model.canSubmitComposer(feed) || submitting ? 1 : 0.4)
    .contentShape(.capsule)
  }
}
