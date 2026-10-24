import SwiftUI

/// What the add composer lays behind its field: the app's background over the screen, and on it the
/// feeds found, nearest the field. Each has one button: it follows or imports the feed, asking which
/// folder to file it in when there are folders. Tapping the background outside the list closes the
/// composer.
struct TabBarComposer: View {
  @Bindable var model: TabBarModel
  let container: CGSize
  /// Top of the field in the bar's coordinates; the list ends a gap above it.
  let fieldTop: CGFloat
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

  var body: some View {
    ZStack(alignment: .bottom) {
      Self.background
        .contentShape(.rect)
        .onTapGesture { model.toggleComposer() }
        .accessibilityHidden(true)

      results
        .padding(.horizontal, TabBarMetrics.edgeInset)
        .padding(.bottom, container.height - fieldTop + TabBarMetrics.composerResultsGap)
    }
    .frame(width: container.width, height: container.height)
    .animation(.easeOut(duration: 0.2), value: model.composerFeeds)
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Feeds found")
    .accessibilityAction(.escape) { model.toggleComposer() }
  }

  @ViewBuilder
  private var results: some View {
    if model.composerFeeds.isEmpty {
      emptyState
    } else {
      // Sized to its rows, up to the space between the status bar and the field, then it scrolls
      // with the last row against the field. Its top edge fades out so a row cut by it does not
      // end in a hard line.
      let rows = CGFloat(model.composerFeeds.count) * TabBarMetrics.composerResultHeight
      ScrollView {
        LazyVStack(spacing: 0) {
          ForEach(model.composerFeeds) { feed in
            row(feed)
          }
        }
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
      .frame(height: min(rows, listHeight))
    }
  }

  /// The space for the list: from a gap below the status bar to a gap above the field.
  private var listHeight: CGFloat {
    max(0, fieldTop - safeTop - TabBarMetrics.composerResultsGap * 2)
  }

  /// Before anything is typed, a hint; after, why nothing is listed. Nothing while a search is
  /// still under way, when the field shows its spinner.
  @ViewBuilder
  private var emptyState: some View {
    let query = model.composerQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    Group {
      if query.isEmpty {
        ContentUnavailableView(
          "Add a feed",
          systemImage: "dot.radiowaves.up.forward",
          description: Text("Search by topic or paste a feed address.")
        )
      } else if model.composerStatus == .failed, let message = model.composerMessage {
        ContentUnavailableView(message, systemImage: "exclamationmark.triangle")
      } else if model.composerStatus != .loading, model.composerMessage != nil {
        ContentUnavailableView.search(text: query)
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
