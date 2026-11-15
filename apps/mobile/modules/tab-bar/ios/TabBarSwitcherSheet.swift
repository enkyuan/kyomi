import SwiftUI

/// What the switcher sheet shows, drawn inside the capsule's glass once it has grown into the
/// sheet: a header with the title and the close button, a row of flat chips that edit and sort the
/// folders, then the folders themselves. A folder opens in place, showing its feeds under its name. It
/// brings no background of its own; the glass is the sheet. Everything that changes a folder is
/// reported to JavaScript, which owns the data.
struct TabBarSwitcherSheet: View {
  let model: TabBarModel
  let switcher: TabBarSwitcher
  let focus: AccessibilityFocusState<Bool>.Binding
  let onClose: () -> Void
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  /// `edit` marks each folder with a radio button, to delete several at once.
  private enum Mode {
    case browse, edit
  }

  private enum SortOrder: String, CaseIterable, Identifiable {
    case automatic = "Default"
    case nameAscending = "Name (A\u{2013}Z)"
    case nameDescending = "Name (Z\u{2013}A)"
    case newest = "Date Created (Newest)"
    case oldest = "Date Created (Oldest)"
    case mostFeeds = "Most Feeds"

    var id: String { rawValue }
  }

  /// The chips' icons are stroked as heavy as their label's strokes (`.subheadline`, medium, is about
  /// 1.5pt thick), so icon and text read as one weight.
  private static let chipIconSize: CGFloat = 18
  private static let chipIconStroke: CGFloat = 1.75

  @State private var mode = Mode.browse
  @State private var draft = ""
  @State private var isCreating = false
  @State private var sort = SortOrder.automatic
  @State private var selection = Set<String>()
  /// Folder ids in the order just dropped, shown until the folders prop arrives in that order.
  @State private var localOrder: [String]?
  @State private var openFolder: SwitcherFolder?
  @State private var renaming: SwitcherFolder?
  @State private var deleting: [SwitcherFolder] = []

  var body: some View {
    VStack(spacing: 0) {
      // The close button sits the same distance from the sheet's top and side edges, as on a system
      // sheet, so it is concentric with the sheet's corner; the title centres on the same line.
      ZStack {
        Text(openFolder?.name ?? switcher.title)
          .font(.headline)
          .lineLimit(1)
          .accessibilityAddTraits(.isHeader)
          .accessibilityFocused(focus)
        HStack {
          if openFolder != nil {
            Button { show(nil) } label: {
              Label("Folders", systemImage: "chevron.left")
                .labelStyle(.iconOnly)
                .fontWeight(.semibold)
                .frame(width: TabBarMetrics.sheetCloseSize, height: TabBarMetrics.sheetCloseSize)
            }
            .buttonStyle(CloseButtonStyle())
          }
          Spacer()
          Button(action: onClose) {
            Label("Close", systemImage: "xmark")
              .labelStyle(.iconOnly)
              .fontWeight(.semibold)
              .frame(width: TabBarMetrics.sheetCloseSize, height: TabBarMetrics.sheetCloseSize)
          }
          .buttonStyle(CloseButtonStyle())
        }
      }
      .padding([.horizontal, .top], TabBarMetrics.sheetCloseInset)

      if let openFolder {
        feedList(in: openFolder)
          .padding(.top, 12)
          .transition(.opacity)
      } else {
        chips
          .padding(.horizontal, TabBarMetrics.sheetCloseInset)
          .padding(.top, 12)
          .padding(.bottom, 8)

        if model.switcherFolders.isEmpty {
          TabBarEmptyState(title: "No folders yet", description: "Add a folder to sort the feeds you follow.")
            .frame(maxHeight: .infinity)
        } else {
          folderList
        }
      }
    }
    // The alerts' default action (Create, Rename) is drawn filled in the app's tint, as on a system alert.
    .tint(model.activeTint)
    .safeAreaInset(edge: .bottom) {
      if mode == .edit, !selection.isEmpty { deleteBar }
    }
    .alert("New folder", isPresented: $isCreating) {
      TextField("Name", text: $draft)
      Button("Cancel", role: .cancel) {}
      Button("Create") { commit(.create) }
        .keyboardShortcut(.defaultAction)
    }
    .alert("Rename folder", isPresented: isRenaming) {
      TextField("Name", text: $draft)
      Button("Cancel", role: .cancel) {}
      Button("Rename") { commit(.rename) }
        .keyboardShortcut(.defaultAction)
    }
    .alert(deleteTitle, isPresented: isDeleting) {
      Button("Cancel", role: .cancel) {}
      Button("Delete", role: .destructive) {
        for folder in deleting { model.onSwitcherFolderAction("delete", folder.id, "") }
        selection.subtract(deleting.map(\.id))
        if mode == .edit, selection.isEmpty { mode = .browse }
      }
    } message: {
      Text("Their feeds stay followed and move to Unsorted.")
    }
    // A folder that is gone (deleted here or elsewhere) cannot stay open or selected, and leaving
    // the last one behind leaves nothing to edit.
    .onChange(of: model.switcherFolders) { _, folders in
      let ids = Set(folders.map(\.id))
      selection.formIntersection(ids)
      localOrder = nil
      if let openFolder, !ids.contains(openFolder.id) { show(nil) }
      if folders.isEmpty { mode = .browse }
    }
  }

  private func show(_ folder: SwitcherFolder?) {
    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
      openFolder = folder
      mode = .browse
      selection = []
    }
  }

  private var deleteTitle: String {
    deleting.count == 1
      ? "Delete \u{201C}\(deleting[0].name)\u{201D}?"
      : "Delete \(deleting.count) folders?"
  }

  /// Deletes what is selected, in the destructive role's red so the action reads before the label does.
  private var deleteBar: some View {
    Button {
      deleting = model.switcherFolders.filter { selection.contains($0.id) }
    } label: {
      Text(selection.count == 1 ? "Delete Folder" : "Delete \(selection.count) Folders")
        .font(.headline)
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .frame(height: 50)
        .background(.red, in: .capsule)
    }
    .buttonStyle(PressDimStyle())
    .padding(.horizontal, TabBarMetrics.sheetCloseInset)
    .padding(.bottom, TabBarMetrics.sheetCloseInset)
  }

  // MARK: Chips

  /// Edit, sort and add as flat chips.
  /// Labels are never truncated: on a width too narrow for all three chips (a small phone, larger
  /// text) the row scrolls sideways instead.
  private var chips: some View {
    ViewThatFits(in: .horizontal) {
      chipRow
      ScrollView(.horizontal) { chipRow }
        .scrollIndicators(.hidden)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var chipRow: some View {
    HStack(spacing: 8) {
      chip("Edit", icon: switcher.editIcon, isOn: mode == .edit, isEnabled: !model.switcherFolders.isEmpty) {
        selection = []
        mode = mode == .edit ? .browse : .edit
      }
      Menu {
        Picker("Sort by", selection: $sort) {
          ForEach(SortOrder.allCases) { Text($0.rawValue).tag($0) }
        }
      } label: {
        chipLabel("Sort", icon: switcher.sortIcon, isOn: sort != .automatic)
      }
      .buttonStyle(.plain)
      .disabled(model.switcherFolders.count < 2)
      .opacity(model.switcherFolders.count < 2 ? 0.4 : 1)
      chip("New Folder", icon: switcher.addIcon, isOn: false, isEnabled: true) {
        draft = ""
        isCreating = true
      }
    }
  }

  private func chip(
    _ title: String, icon: TabBarIcon, isOn: Bool, isEnabled: Bool, action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      chipLabel(title, icon: icon, isOn: isOn)
    }
    .buttonStyle(.plain)
    .disabled(!isEnabled)
    .opacity(isEnabled ? 1 : 0.4)
    .accessibilityAddTraits(isOn ? .isSelected : [])
  }

  /// One drawing for all three chips, button or menu: the fill, the glyph and the label. The glyph is a
  /// template image, so it takes the label's foreground exactly as the text does.
  private func chipLabel(_ title: String, icon: TabBarIcon, isOn: Bool) -> some View {
    HStack(spacing: 6) {
      Image(uiImage: icon.stroked(toPoints: Self.chipIconStroke, iconSize: Self.chipIconSize).templateImage(size: Self.chipIconSize))
        .renderingMode(.template)
        .accessibilityHidden(true)
      Text(title)
        .font(.subheadline.weight(.medium))
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
    }
    .foregroundStyle(isOn ? AnyShapeStyle(model.activeTint) : AnyShapeStyle(.primary))
    .padding(.horizontal, 12)
    .frame(height: 36)
    .background(isOn ? AnyShapeStyle(model.activeTint.opacity(0.2)) : AnyShapeStyle(.fill.tertiary), in: .capsule)
    .contentShape(.capsule)
  }

  // MARK: Folders

  /// The folders as shown: the order the user dropped them in until the server's own list catches up,
  /// or the chosen sort.
  private var sortedFolders: [SwitcherFolder] {
    let folders = model.switcherFolders
    switch sort {
    case .automatic:
      guard let localOrder else { return folders }
      let byID = Dictionary(uniqueKeysWithValues: folders.map { ($0.id, $0) })
      let placed = localOrder.compactMap { byID[$0] }
      return placed + folders.filter { !localOrder.contains($0.id) }
    case .nameAscending: return folders.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    case .nameDescending: return folders.sorted { $0.name.localizedStandardCompare($1.name) == .orderedDescending }
    case .newest: return folders.sorted { $0.createdAt > $1.createdAt }
    case .oldest: return folders.sorted { $0.createdAt < $1.createdAt }
    case .mostFeeds:
      return folders.sorted {
        $0.feedCount == $1.feedCount
          ? $0.name.localizedStandardCompare($1.name) == .orderedAscending
          : $0.feedCount > $1.feedCount
      }
    }
  }

  /// A system `List` in edit mode, as the docs describe it: with a selection binding it puts a
  /// selection circle before each row, and with `onMove` a reorder handle (three bars) after it, so
  /// both the controls and the drag are the platform's own.
  private var folderList: some View {
    List(selection: $selection) {
      ForEach(sortedFolders) { folder in
        row(folder)
          .tag(folder.id)
          .listRowBackground(Color.clear)
          .listRowSeparator(.hidden)
          .listRowInsets(EdgeInsets(top: 0, leading: TabBarMetrics.sheetCloseInset, bottom: 0, trailing: TabBarMetrics.sheetCloseInset))
          // A sorted list has no manual order to change, so it offers no handle.
          .moveDisabled(sort != .automatic)
      }
      .onMove(perform: move)
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .environment(\.editMode, .constant(mode == .edit ? .active : .inactive))
    .contentMargins(.bottom, TabBarMetrics.sheetCloseInset, for: .scrollContent)
    .fadedTopEdge()
  }

  private func move(from source: IndexSet, to destination: Int) {
    var ids = sortedFolders.map(\.id)
    ids.move(fromOffsets: source, toOffset: destination)
    localOrder = ids
    model.onSwitcherFolderAction("reorder", "", ids.joined(separator: "\n"))
  }

  @ViewBuilder
  private func row(_ folder: SwitcherFolder) -> some View {
    let content = HStack(spacing: 12) {
      // The feed count rides the name's cap height as a superscript.
      Text("\(Text(folder.name))\(Text(" \(folder.feedCount)").font(.caption).monospacedDigit().baselineOffset(10).foregroundStyle(.secondary))")
        .font(.title3)
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .frame(minHeight: 52)
    .contentShape(.rect)

    // Editing selects through the list; browsing opens the folder.
    Group {
      if mode == .edit {
        content
      } else {
        Button { show(folder) } label: { content }.buttonStyle(.plain)
      }
    }
    .softensAtTop()
    // Renaming and deleting a single folder live on a long press, so a row stays a plain target.
    .contextMenu {
      Button("Rename", systemImage: "pencil") {
        draft = folder.name
        renaming = folder
      }
      Button("Delete", systemImage: "trash", role: .destructive) { deleting = [folder] }
    }
    .accessibilityLabel(folder.name)
    .accessibilityValue("\(folder.feedCount) feeds")
    .accessibilityHint(mode == .edit ? "Selects this folder to delete" : "Shows the feeds in this folder")
  }

  // MARK: Feeds

  /// The feeds filed in a folder, each with its favicon in the squircle every favicon gets.
  private func feedList(in folder: SwitcherFolder) -> some View {
    let feeds = model.switcherFeeds.filter { $0.folderID == folder.id }
    return Group {
      if feeds.isEmpty {
        TabBarEmptyState(title: "No feeds yet", description: "Feeds you file in this folder appear here.")
          .frame(maxHeight: .infinity)
      } else {
        ScrollView {
          LazyVStack(spacing: 0) {
            ForEach(feeds) { feed in
              HStack(spacing: 12) {
                AsyncImage(url: feed.faviconURL) { image in
                  image.resizable().scaledToFit()
                } placeholder: {
                  Image(systemName: "dot.radiowaves.up.forward").foregroundStyle(.secondary)
                }
                .frame(width: 32, height: 32)
                .clipShape(.rect(cornerRadius: 32 * 0.25, style: .continuous))
                .accessibilityHidden(true)
                Text(feed.title)
                  .font(.title3)
                  .lineLimit(1)
                  .frame(maxWidth: .infinity, alignment: .leading)
              }
              .frame(minHeight: 52)
              .accessibilityElement(children: .combine)
              .softensAtTop()
            }
          }
          .padding(.horizontal, TabBarMetrics.sheetCloseInset)
          .padding(.bottom, TabBarMetrics.sheetCloseInset)
        }
        .fadedTopEdge()
      }
    }
  }

  // MARK: Prompts

  private enum Commit {
    case create, rename
  }

  /// A blank name, or the one a folder already has, changes nothing.
  private func commit(_ kind: Commit) {
    let name = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    switch kind {
    case .create:
      guard !name.isEmpty else { return }
      model.onSwitcherFolderAction("create", "", name)
    case .rename:
      guard let renaming, !name.isEmpty, name != renaming.name else { return }
      model.onSwitcherFolderAction("rename", renaming.id, name)
    }
  }

  private var isRenaming: Binding<Bool> {
    Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })
  }

  private var isDeleting: Binding<Bool> {
    Binding(get: { !deleting.isEmpty }, set: { if !$0 { deleting = [] } })
  }
}

/// A list clipped under the header or the chips softens into that edge instead of cutting a row
/// mid-glyph in a hard line: a mask fades the top edge to clear, its height following the scroll
/// offset, so at rest, with the first row against the edge, nothing is faded.
private struct TopFadedScroll: ViewModifier {
  private static let height: CGFloat = 28
  @State private var fade: CGFloat = 0

  func body(content: Content) -> some View {
    content
      .onScrollGeometryChange(for: CGFloat.self) { geometry in
        min(max(geometry.contentOffset.y + geometry.contentInsets.top, 0), Self.height)
      } action: { _, value in
        fade = value
      }
      .mask(alignment: .top) {
        VStack(spacing: 0) {
          LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom)
            .frame(height: fade)
          Rectangle()
        }
      }
  }
}

private extension View {
  func fadedTopEdge() -> some View { modifier(TopFadedScroll()) }

  /// A row leaving under the edge blurs and fades in proportion to how much of it has left, so the
  /// list softens into its top edge. Nothing is drawn over the list, so the edge has no seam.
  func softensAtTop() -> some View {
    scrollTransition(topLeading: .interactive, bottomTrailing: .identity, axis: .vertical) { content, phase in
      content
        .blur(radius: 10 * max(0, -phase.value))
        .opacity(1 + min(0, phase.value))
    }
  }
}

/// The app's close button (the email sign-in sheet's) at the system sheet's 44pt: a filled circle,
/// not glass on glass, that dims while pressed as `.bordered` does. `.bordered` itself sizes the
/// circle from its label, so it cannot be held at an exact size.
private struct CloseButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(.primary)
      .background(.fill.tertiary, in: .circle)
      .contentShape(.circle)
      .opacity(configuration.isPressed ? 0.5 : 1)
  }
}

/// A plain control that dims while pressed, like the close button.
private struct PressDimStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label.opacity(configuration.isPressed ? 0.5 : 1)
  }
}
