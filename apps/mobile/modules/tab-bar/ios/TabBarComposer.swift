import SwiftUI

/// The add composer: a layer over the whole screen, the bar included, that brings its own
/// background, search field and close button, so the bar underneath is only faded out. The feeds
/// found list above the field, each with one button that follows or imports it, asking which folder
/// to file it in when there are folders. Tapping the background outside the list closes it.
struct TabBarComposer: View {
  @Bindable var model: TabBarModel
  /// The list opens on its first row, the best match, whenever feeds arrive.
  @State private var position = ScrollPosition(edge: .top)
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
  /// At rest the list sits between the status bar's fade and a gap above the field.
  private var listTop: CGFloat { safeTop + TabBarMetrics.composerFadeLength }
  private var listBottomInset: CGFloat { container.height - field.minY + TabBarMetrics.composerResultsGap }
  private var listHeight: CGFloat { max(0, container.height - listTop - listBottomInset) }

  var body: some View {
    ZStack(alignment: .topLeading) {
      Self.background
        .onTapGesture { model.toggleComposer() }
        .accessibilityHidden(true)

      results
        .frame(width: container.width, height: container.height, alignment: .top)

      GlassEffectContainer(spacing: 0) {
        // Each child is positioned over the whole container, so they need a stack to share it.
        ZStack(alignment: .topLeading) {
          fieldView
            .position(x: field.midX, y: field.midY)
          closeButton
            .position(x: close.midX, y: close.midY)
        }
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
    TabBarField(
      text: $model.composerQuery,
      focused: focused,
      placeholder: "Search or paste a URL",
      returnKey: .go,
      keyboard: .webSearch,
      loading: model.composerStatus == .loading
    ) {
      model.submitComposer()
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
    // The spinner takes the clear button's place, so the field never changes width while a search
    // runs: UIKit would slide the clear button in from the edge along with the new width.
    .overlay(alignment: .trailing) {
      if model.composerStatus == .loading {
        ProgressView()
          .frame(width: field.height, height: field.height)
          .transition(.opacity)
      }
    }
    .animation(.easeOut(duration: 0.15), value: model.composerStatus == .loading)
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
      // The scroll view fills the screen, under the status bar above and behind the field below,
      // so rows leave through both without a cut edge. Margins hold the first row below the
      // status bar and the last above the field when the list is at its ends. A short list rests
      // on the field, and a long one opens on its first row.
      ScrollView {
        VStack(spacing: 0) {
          Spacer(minLength: 0)
          ForEach(model.composerFeeds) { feed in
            row(feed)
          }
        }
        .frame(minHeight: listHeight)
        .padding(.horizontal, TabBarMetrics.edgeInset)
        .background {
          Color.clear
            .contentShape(.rect)
            .onTapGesture { model.toggleComposer() }
        }
      }
      .contentMargins(.top, listTop, for: .scrollContent)
      .contentMargins(.bottom, listBottomInset, for: .scrollContent)
      .scrollIndicators(.hidden)
      .scrollBounceBehavior(.basedOnSize)
      .scrollPosition($position)
      .onChange(of: model.composerFeeds) { position.scrollTo(edge: .top) }
      // Nothing shows behind the status bar, which would read as tappable and cost the clock its
      // legibility (HIG, "Obscure content under the status bar"); below it the background eases
      // away, as the scrim of `progressive-blur.tsx` does. A material would only tint the flat
      // background, so it is left out.
      .overlay(alignment: .top) {
        LinearGradient(
          stops: [
            .init(color: Self.background, location: 0),
            .init(color: Self.background, location: safeTop / max(listTop, 1)),
            .init(color: Self.background.opacity(0.4), location: (safeTop / max(listTop, 1) + 1) / 2),
            .init(color: Self.background.opacity(0), location: 1),
          ],
          startPoint: .top,
          endPoint: .bottom
        )
        .frame(height: listTop)
        .allowsHitTesting(false)
      }
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
    .padding(.top, listTop)
  }

  private func row(_ feed: ComposerFeed) -> some View {
    HStack(spacing: 12) {
      AsyncImage(url: feed.faviconURL) { image in
        image.resizable().scaledToFit()
      } placeholder: {
        Image(systemName: "dot.radiowaves.up.forward").foregroundStyle(.secondary)
      }
      .frame(width: 36, height: 36)
      // A squircle like every favicon: the continuous corner at a quarter of the icon.
      .clipShape(.rect(cornerRadius: 36 * 0.25, style: .continuous))

      VStack(alignment: .leading, spacing: 2) {
        Text(feed.title).font(.subheadline.weight(.semibold)).lineLimit(1)
        Text(feed.detail ?? feed.url).font(.caption).foregroundStyle(.secondary).lineLimit(1)
      }
      Spacer(minLength: 0)

      if feed.isSubscribed {
        addedMark
      } else {
        action(feed)
      }
    }
    .frame(height: TabBarMetrics.composerResultHeight)
  }

  /// With folders, pressing the button lists them to file the feed in; without, it follows at once.
  private func action(_ feed: ComposerFeed) -> some View {
    Group {
      if model.composerFolders.isEmpty {
        Button { model.submitComposer(feed) } label: { actionLabel(feed) }
      } else {
        Menu {
          Button("Unsorted", systemImage: "tray") { model.submitComposer(feed) }
          ForEach(model.composerFolders) { folder in
            Button(folder.name, systemImage: "folder") { model.submitComposer(feed, folderID: folder.id) }
          }
        } label: {
          actionLabel(feed)
        }
      }
    }
    .buttonStyle(.plain)
    .disabled(!model.canSubmitComposer(feed))
  }

  /// A check where the feed is already followed or filed in a folder.
  private var addedMark: some View {
    markView(icon: model.composerAddedIcon, symbol: "checkmark.circle.fill", color: Self.glyphColor)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("Following")
  }

  /// The plus that follows or imports; a spinner replaces it while that feed is being submitted.
  private func actionLabel(_ feed: ComposerFeed) -> some View {
    let submitting = model.composerStatus == .submitting && model.composerSubmittingID == feed.id
    return ZStack {
      markView(icon: model.composerAddIcon, symbol: "plus.circle.fill", color: model.activeTint)
        .opacity(submitting ? 0 : 1)
      if submitting {
        ProgressView()
      }
    }
    .frame(width: TabBarMetrics.composerMarkTarget, height: TabBarMetrics.composerMarkTarget)
    .opacity(model.canSubmitComposer(feed) || submitting ? 1 : 0.4)
    .contentShape(.rect)
    .accessibilityLabel(model.composerKind == .import ? "Import" : "Follow")
  }

  @ViewBuilder
  private func markView(icon: TabBarIcon?, symbol: String, color: Color) -> some View {
    Group {
      if let icon {
        TabBarIconView(icon: icon, size: TabBarMetrics.composerMarkSize, color: color)
      } else {
        Image(systemName: symbol)
          .font(.system(size: TabBarMetrics.composerMarkSize))
          .foregroundStyle(color)
      }
    }
    .frame(width: TabBarMetrics.composerMarkTarget, height: TabBarMetrics.composerMarkTarget, alignment: .trailing)
  }
}
