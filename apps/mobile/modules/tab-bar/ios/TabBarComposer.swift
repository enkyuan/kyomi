import SwiftUI

/// What the add composer lays behind its field: the screen blurred from the top down, and over it
/// the feeds found, nearest the field, each with the folder to file it in and its own Follow (or
/// Import) button. Tapping the blur outside the list closes the composer.
struct TabBarComposer: View {
  @Bindable var model: TabBarModel
  let container: CGSize
  /// Top of the field in the bar's coordinates; the list ends a gap above it.
  let fieldTop: CGFloat
  let safeTop: CGFloat

  var body: some View {
    ZStack(alignment: .bottom) {
      backdrop
      results
        .padding(.bottom, container.height - fieldTop + TabBarMetrics.composerResultsGap)
    }
    .frame(width: container.width, height: container.height)
    .animation(.easeOut(duration: 0.2), value: model.composerFeeds)
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Add a feed")
    .accessibilityAction(.escape) { model.toggleComposer() }
  }

  /// Blurs and tones down what is behind, most where the list sits and not at all at the top, so
  /// the list reads over any content.
  private var backdrop: some View {
    Rectangle()
      .fill(.regularMaterial)
      .mask(
        LinearGradient(
          stops: [
            .init(color: .clear, location: 0),
            .init(color: .black, location: 0.45),
            .init(color: .black, location: 1),
          ],
          startPoint: .top,
          endPoint: .bottom
        )
      )
      .contentShape(.rect)
      .onTapGesture { model.toggleComposer() }
      .accessibilityHidden(true)
  }

  @ViewBuilder
  private var results: some View {
    let available = max(0, fieldTop - safeTop - TabBarMetrics.composerResultsGap * 2)
    if model.composerFeeds.isEmpty {
      if let message = model.composerMessage {
        Text(message)
          .font(.footnote)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, TabBarMetrics.composerInset + 12)
          .transition(.opacity)
      }
    } else {
      // A short list sits at the field and a long one scrolls, ending at the field.
      ViewThatFits(in: .vertical) {
        list
        ScrollView {
          list
        }
        .scrollIndicators(.hidden)
        .defaultScrollAnchor(.bottom)
      }
      .frame(maxHeight: available)
    }
  }

  private var list: some View {
    VStack(spacing: 0) {
      ForEach(model.composerFeeds) { feed in
        row(feed)
          .transition(.opacity)
      }
    }
    .padding(.horizontal, TabBarMetrics.composerInset + 12)
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
        if !feed.isSubscribed, !model.composerFolders.isEmpty {
          folderMenu(feed)
        }
      }
      Spacer(minLength: 0)

      if feed.isSubscribed {
        Text("Following").font(.footnote).foregroundStyle(.secondary)
      } else {
        actionButton(feed)
      }
    }
    .frame(height: TabBarMetrics.composerResultHeight)
    .accessibilityElement(children: .contain)
  }

  /// Text only, in the foreground colour, with no button chrome.
  private func folderMenu(_ feed: ComposerFeed) -> some View {
    let selection = Binding(
      get: { model.composerFolderID(for: feed) },
      set: { model.setComposerFolderID($0, for: feed) }
    )
    let name = model.composerFolders.first { $0.id == selection.wrappedValue }?.name ?? "Unsorted"
    return Menu {
      Picker("Folder", selection: selection) {
        Label("Unsorted", systemImage: "tray").tag(String?.none)
        ForEach(model.composerFolders) { folder in
          Label(folder.name, systemImage: "folder").tag(String?.some(folder.id))
        }
      }
    } label: {
      HStack(spacing: 4) {
        Text(name).lineLimit(1)
        Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
      }
      .font(.footnote.weight(.medium))
      .foregroundStyle(.primary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Folder, \(name)")
  }

  private func actionButton(_ feed: ComposerFeed) -> some View {
    let enabled = model.canSubmitComposer(feed)
    let submitting = model.composerStatus == .submitting && model.composerSubmittingID == feed.id
    return Button {
      model.submitComposer(feed)
    } label: {
      ZStack {
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
      .opacity(enabled || submitting ? 1 : 0.4)
      .contentShape(.capsule)
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
  }
}
