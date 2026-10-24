import SwiftUI

/// What the add composer shows once the add button's glass has grown into a card: the address or
/// words to search for, the feeds found, and a bottom row with the folder to file the feed in and
/// the primary button, Import for a typed address and Follow for a search. It brings no background
/// of its own; the glass is the card.
struct TabBarComposer: View {
  @Bindable var model: TabBarModel
  var focus: FocusState<Bool>.Binding

  var body: some View {
    VStack(spacing: TabBarMetrics.composerSpacing) {
      field
      results
      HStack(spacing: 8) {
        folderMenu
        Spacer(minLength: 0)
        primaryButton
      }
      .frame(height: TabBarMetrics.composerRowHeight)
    }
    .padding(TabBarMetrics.composerPadding)
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Add a feed")
    .accessibilityAction(.escape) { model.toggleComposer() }
  }

  private var field: some View {
    HStack(spacing: 8) {
      TextField("Feed address or search", text: $model.composerQuery)
        .focused(focus)
        .keyboardType(.webSearch)
        .submitLabel(.go)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .onSubmit { model.submitComposer() }

      if model.composerStatus == .loading {
        ProgressView()
      }

      Button {
        model.toggleComposer()
      } label: {
        Image(systemName: "xmark")
          .font(.system(size: 13, weight: .bold))
          .foregroundStyle(.secondary)
          .frame(width: 30, height: 30)
          .background(.fill.tertiary, in: .circle)
          .contentShape(.circle)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Close")
    }
    .frame(height: TabBarMetrics.composerRowHeight)
  }

  @ViewBuilder
  private var results: some View {
    if model.composerFeeds.isEmpty, let message = model.composerMessage {
      Text(message)
        .font(.footnote)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, minHeight: TabBarMetrics.composerResultHeight, alignment: .leading)
    } else if !model.composerFeeds.isEmpty {
      ScrollView {
        LazyVStack(spacing: 0) {
          ForEach(model.composerFeeds) { feed in
            row(feed)
          }
        }
      }
      .scrollIndicators(.hidden)
      .frame(height: CGFloat(min(model.composerFeeds.count, TabBarMetrics.composerMaxResults)) * TabBarMetrics.composerResultHeight)
    }
  }

  private func row(_ feed: ComposerFeed) -> some View {
    let selected = model.composerKind == .follow && feed.id == model.composerTarget?.id
    return Button {
      model.composerSelection = feed.id
    } label: {
      HStack(spacing: 12) {
        AsyncImage(url: feed.faviconURL) { image in
          image.resizable().scaledToFit()
        } placeholder: {
          Image(systemName: "dot.radiowaves.up.forward").foregroundStyle(.secondary)
        }
        .frame(width: 28, height: 28)
        .clipShape(.rect(cornerRadius: 6))

        VStack(alignment: .leading, spacing: 2) {
          Text(feed.title).font(.subheadline.weight(.semibold)).lineLimit(1)
          Text(feed.detail ?? feed.url).font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }
        Spacer(minLength: 0)

        if feed.isSubscribed {
          Text("Following").font(.caption).foregroundStyle(.secondary)
        } else if selected {
          Image(systemName: "checkmark.circle.fill").foregroundStyle(model.activeTint)
        }
      }
      .frame(height: TabBarMetrics.composerResultHeight)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(selected ? .isSelected : [])
  }

  private var folderMenu: some View {
    let name = model.composerFolders.first { $0.id == model.composerFolderID }?.name ?? "Unsorted"
    return Menu {
      Picker("Folder", selection: $model.composerFolderID) {
        Label("Unsorted", systemImage: "tray").tag(String?.none)
        ForEach(model.composerFolders) { folder in
          Label(folder.name, systemImage: "folder").tag(String?.some(folder.id))
        }
      }
    } label: {
      HStack(spacing: 6) {
        Image(systemName: "folder")
        Text(name).lineLimit(1)
        Image(systemName: "chevron.down").font(.caption2.weight(.bold))
      }
      .font(.system(size: 15, weight: .medium))
      .foregroundStyle(.primary.opacity(0.82))
      .padding(.horizontal, 14)
      .frame(height: 40)
      .background(.fill.tertiary, in: .capsule)
    }
    .accessibilityLabel("Folder, \(name)")
  }

  private var primaryButton: some View {
    let enabled = model.composerCanSubmit
    return Button {
      model.submitComposer()
    } label: {
      ZStack {
        Text(model.composerKind == .import ? "Import" : "Follow")
          .contentTransition(.opacity)
          .opacity(model.composerStatus == .submitting ? 0 : 1)
        if model.composerStatus == .submitting {
          ProgressView().tint(model.addIconColor)
        }
      }
      .font(.system(size: 17, weight: .semibold))
      .foregroundStyle(model.addIconColor)
      .padding(.horizontal, 22)
      .frame(height: 44)
      .background(model.activeTint, in: .capsule)
      .opacity(enabled || model.composerStatus == .submitting ? 1 : 0.4)
    }
    .buttonStyle(.plain)
    .disabled(!enabled)
    .animation(.easeOut(duration: 0.18), value: model.composerKind)
  }
}
