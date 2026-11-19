import SwiftUI
import UIKit

/// What the switcher sheet shows, drawn inside the capsule's glass once it has grown into the
/// sheet: a header with the title and the close button, a row of flat chips that edit and sort the
/// folders, then the folders themselves. A folder opens in place, showing its feeds under its name. It
/// brings no background of its own; the glass is the sheet. Everything that changes a folder is
/// reported to JavaScript, which owns the data.
struct TabBarSwitcherSheet: View {
  let model: TabBarModel
  let switcher: TabBarSwitcher
  let focus: AccessibilityFocusState<Bool>.Binding
  /// Closes the sheet, for an action that leaves it for another screen.
  let onDismiss: () -> Void
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  /// A row's height, which scales with the text size; the drag moves in whole rows.
  @ScaledMetric(relativeTo: .title3) private var rowHeight: CGFloat = 52

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
  /// The folder the server always lists first (`DEFAULT_FOLDER_NAME` in the API).
  private static let defaultFolderName = "Unsorted"
  /// How far the chips sit below the sheet's top edge when the list has no header: clear of the grabber.
  private static let listTop: CGFloat = 28
  /// A lifted row's corner radius, continuous like the sheet's own.
  private static let liftedRadius: CGFloat = 14
  private static let chipIconSize: CGFloat = 18
  private static let chipIconStroke: CGFloat = 1.75

  @State private var mode = Mode.browse
  @State private var draft = ""
  @State private var isCreating = false
  @State private var sort = SortOrder.automatic
  @State private var selection = Set<String>()
  /// The folder being dragged, how far it has been dragged, and the place it started from.
  @State private var dragging: String?
  @State private var dragOffset: CGFloat = 0
  @State private var dragStart = 0
  /// Folder ids in the order just dropped, shown until the folders prop arrives in that order.
  @State private var localOrder: [String]?
  @State private var openFolderID: String?
  @State private var renaming: SwitcherFolder?
  @State private var deleting: [SwitcherFolder] = []

  var body: some View {
    VStack(spacing: 0) {
      // The folder list has no title: the sheet closes by its grabber, a drag or a tap outside, and
      // the chips say what it is for. Inside a folder the header holds that folder's name, the way
      // back and the way to rename it. Both buttons sit the same distance from the sheet's top and
      // side edges, as on a system sheet, so they are concentric with its corner; the title centres
      // on the same line.
      if let openFolder {
        ZStack {
          Text(openFolder.name)
            .font(.headline)
            .lineLimit(1)
            .padding(.horizontal, TabBarMetrics.sheetCloseSize + 8)
            .accessibilityAddTraits(.isHeader)
            .accessibilityFocused(focus)
          HStack {
            Button { show(nil) } label: {
              Label("Folders", systemImage: "chevron.left")
                .labelStyle(.iconOnly)
                .fontWeight(.semibold)
                .frame(width: TabBarMetrics.sheetCloseSize, height: TabBarMetrics.sheetCloseSize)
            }
            .buttonStyle(RoundButtonStyle())
            Spacer()
            Button {
              draft = openFolder.name
              renaming = openFolder
            } label: {
              Image(uiImage: switcher.renameIcon.stroked(toPoints: Self.chipIconStroke, iconSize: 20).templateImage(size: 20))
                .renderingMode(.template)
                .frame(width: TabBarMetrics.sheetCloseSize, height: TabBarMetrics.sheetCloseSize)
            }
            .buttonStyle(RoundButtonStyle())
            .accessibilityLabel("Rename folder")
          }
        }
        .frame(height: TabBarMetrics.sheetCloseSize)
        .padding([.horizontal, .top], TabBarMetrics.sheetCloseInset)
      }

      if let openFolder {
        feedList(in: openFolder)
          .padding(.top, 12)
          .transition(.opacity)
      } else {
        chips
          .padding(.top, Self.listTop)
          .padding(.bottom, 8)

        if model.switcherFolders.isEmpty {
          TabBarEmptyState(title: "No folders yet", description: "Add a folder to sort the feeds you follow.")
            .frame(maxHeight: .infinity)
        } else {
          folderList
        }
      }
    }
    .safeAreaInset(edge: .bottom) {
      if mode == .edit, !selection.isEmpty { deleteBar }
    }
    // The bar every sheet carries to say it can be dragged away.
    .overlay(alignment: .top) {
      Capsule()
        .fill(.tertiary)
        .frame(width: 36, height: 5)
        .padding(.top, 6)
        .allowsHitTesting(false)
        // With no title on the folder list, the grabber is what VoiceOver lands on, named for the sheet.
        .accessibilityHidden(openFolder != nil)
        .accessibilityLabel(switcher.title)
        .accessibilityAddTraits(.isHeader)
        .accessibilityFocused(focus)
    }
    .background { alertHost }
    // A folder that is gone (deleted here or elsewhere) cannot stay open or selected, and leaving
    // the last one behind leaves nothing to edit.
    .onChange(of: model.switcherFolders) { _, folders in
      let ids = Set(folders.map(\.id))
      selection.formIntersection(ids)
      localOrder = nil
      if let openFolderID, !ids.contains(openFolderID) { show(nil) }
      if folders.isEmpty { mode = .browse }
    }
  }

  /// The alerts hang off an empty view of their own. They keep the system's colours: a tint here
  /// would colour every button's text, Cancel included, and leave the default action's fill alone.
  private var alertHost: some View {
    Color.clear
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
  }

  private func show(_ folder: SwitcherFolder?) {
    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
      openFolderID = folder?.id
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
      chipRow.padding(.horizontal, TabBarMetrics.sheetCloseInset)
      // The scroller spans the sheet's full width and carries the inset as content margin, so
      // chips run off the sheet's edge instead of being cut at the padding.
      ScrollView(.horizontal) { chipRow }
        .contentMargins(.horizontal, TabBarMetrics.sheetCloseInset, for: .scrollContent)
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
      chip("Import", icon: switcher.importIcon, isOn: false, isEnabled: true) {
        model.onSwitcherFolderAction("import", "", "")
        onDismiss()
      }
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
  /// The open folder as the server has it now, so a rename shows in the title as soon as it lands.
  private var openFolder: SwitcherFolder? {
    model.switcherFolders.first { $0.id == openFolderID }
  }

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

  /// The folders, one row each. Editing adds a radio button before a name and a three-bar handle after
  /// it. Dragging the handle lifts the row itself, at full size, and the rows it passes slide aside.
  private var folderList: some View {
    let folders = sortedFolders
    return ScrollView {
      LazyVStack(spacing: 0) {
        ForEach(Array(folders.enumerated()), id: \.element.id) { index, folder in
          row(folder)
            .offset(y: offset(of: index, folder: folder, count: folders.count))
            .zIndex(dragging == folder.id ? 1 : 0)
        }
      }
      .padding(.horizontal, TabBarMetrics.sheetCloseInset)
      .padding(.bottom, TabBarMetrics.sheetCloseInset)
      .coordinateSpace(.named(Self.listSpace))
    }
    // The finger is on the handle; the list must not scroll under it.
    .scrollDisabled(dragging != nil)
    .fadedTopEdge()
  }

  private static let listSpace = "folderList"

  /// Where the dragged row would land: its start moved by whole rows, never above the default folder.
  private func target(count: Int) -> Int {
    let floor = sortedFolders.first?.name == Self.defaultFolderName ? 1 : 0
    let moved = dragStart + Int((dragOffset / rowHeight).rounded())
    return min(max(moved, floor), count - 1)
  }

  /// The dragged row follows the finger; the rows between its start and its target step one row aside.
  private func offset(of index: Int, folder: SwitcherFolder, count: Int) -> CGFloat {
    guard let dragging else { return 0 }
    if folder.id == dragging { return dragOffset }
    let end = target(count: count)
    if dragStart < end, index > dragStart, index <= end { return -rowHeight }
    if dragStart > end, index >= end, index < dragStart { return rowHeight }
    return 0
  }

  private func row(_ folder: SwitcherFolder) -> some View {
    let isSelected = selection.contains(folder.id)
    let isLifted = dragging == folder.id
    let canMove = sort == .automatic && folder.name != Self.defaultFolderName
    return HStack(spacing: 12) {
      Button { press(folder) } label: {
        HStack(spacing: 12) {
          // Editing puts a radio button before each name: empty to filled, in the app's tint.
          if mode == .edit {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
              .font(.title3)
              .foregroundStyle(isSelected ? AnyShapeStyle(model.activeTint) : AnyShapeStyle(.secondary))
              .accessibilityHidden(true)
          }
          // The feed count rides the name's cap height as a superscript.
          Text("\(Text(folder.name))\(Text(" \(folder.feedCount)").font(.caption).monospacedDigit().baselineOffset(10).foregroundStyle(.secondary))")
            .font(.title3)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: rowHeight)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)

      if mode == .edit, canMove {
        handle(for: folder)
      }
    }
    .padding(.horizontal, isLifted ? 12 : 0)
    .background { if isLifted { liftedBackground } }
    // The card is wider than the row by its padding, so the text stays where it was.
    .padding(.horizontal, isLifted ? -12 : 0)
    // Rows that make way glide; the lifted row follows the finger exactly, with no animation of its own.
    .animation(reduceMotion || isLifted ? nil : .snappy(duration: 0.2), value: dragOffset == 0 ? -1 : target(count: model.switcherFolders.count))
    // Renaming and deleting a single folder live on a long press, so a row stays a plain target.
    .contextMenu {
      Button {
        draft = folder.name
        renaming = folder
      } label: {
        menuLabel("Rename", icon: switcher.renameIcon)
      }
      Button(role: .destructive) {
        deleting = [folder]
      } label: {
        menuLabel("Delete", icon: switcher.deleteIcon)
      }
    }
    .accessibilityLabel(folder.name)
    .accessibilityValue(mode == .edit ? (isSelected ? "Selected" : "Not selected") : "\(folder.feedCount) feeds")
    .accessibilityHint(mode == .edit ? "Selects this folder to delete" : "Shows the feeds in this folder")
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }

  /// A menu item with a Blode glyph, a template image so the menu colours it like the title.
  private func menuLabel(_ title: String, icon: TabBarIcon) -> some View {
    Label {
      Text(title)
    } icon: {
      Image(uiImage: icon.stroked(toPoints: Self.chipIconStroke, iconSize: Self.chipIconSize).templateImage(size: Self.chipIconSize))
        .renderingMode(.template)
    }
  }

  /// What a lifted row is made of: a translucent material, the theme's own so it follows light and
  /// dark, in a continuous rounded shape. Raised the way the system raises a card: a hairline edge in
  /// the foreground colour at low opacity, and two transparent shadows, a tight contact one and a
  /// wide soft one, so it reads as lifted off the sheet rather than outlined.
  private var liftedBackground: some View {
    let shape = RoundedRectangle(cornerRadius: Self.liftedRadius, style: .continuous)
    return shape
      .fill(.regularMaterial)
      .overlay { shape.strokeBorder(Color.primary.opacity(0.12), lineWidth: 0.5) }
      .shadow(color: .black.opacity(0.10), radius: 1, y: 1)
      .shadow(color: .black.opacity(0.18), radius: 14, y: 8)
  }

  /// The three-bar handle. It takes the touch ahead of the sheet's own drag and the list's scroll, so
  /// a press on it moves the folder and nothing else; the rest of the row is untouched.
  private func handle(for folder: SwitcherFolder) -> some View {
    Image(uiImage: switcher.reorderIcon.stroked(toPoints: Self.chipIconStroke, iconSize: 22).templateImage(size: 22))
      .renderingMode(.template)
      .foregroundStyle(.secondary)
      .frame(width: 44, height: 44)
      .contentShape(.rect)
      .highPriorityGesture(
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.listSpace))
          .onChanged { value in
            if dragging == nil {
              // The lift, felt as the row leaves the list.
              UIImpactFeedbackGenerator(style: .medium).impactOccurred()
              dragStart = sortedFolders.firstIndex(of: folder) ?? 0
              dragging = folder.id
            }
            let before = target(count: sortedFolders.count)
            dragOffset = value.translation.height
            // A tick each time the row passes another.
            if target(count: sortedFolders.count) != before { UISelectionFeedbackGenerator().selectionChanged() }
          }
          .onEnded { _ in drop() }
      )
      .accessibilityLabel("Reorder \(folder.name)")
      .accessibilityAddTraits(.isButton)
      .accessibilityAction(named: "Move up") { shift(folder, by: -1) }
      .accessibilityAction(named: "Move down") { shift(folder, by: 1) }
  }

  /// Lets go: the row settles into the place it was over, and then the order is saved and the offsets
  /// are cleared in one step, which moves nothing, as the layout has caught up with them.
  private func drop() {
    guard dragging != nil else { return }
    let count = sortedFolders.count
    let end = target(count: count)
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    withAnimation(reduceMotion ? nil : .snappy(duration: 0.2), completionCriteria: .logicallyComplete) {
      dragOffset = CGFloat(end - dragStart) * rowHeight
    } completion: {
      var ids = sortedFolders.map(\.id)
      let moved = ids.remove(at: dragStart)
      ids.insert(moved, at: end)
      var transaction = Transaction()
      transaction.disablesAnimations = true
      withTransaction(transaction) {
        if end != dragStart { save(ids) }
        dragging = nil
        dragOffset = 0
      }
    }
  }

  /// VoiceOver's way to reorder: one step at a time.
  private func shift(_ folder: SwitcherFolder, by step: Int) {
    var ids = sortedFolders.map(\.id)
    let floor = sortedFolders.first?.name == Self.defaultFolderName ? 1 : 0
    guard let from = ids.firstIndex(of: folder.id), (floor..<ids.count).contains(from + step) else { return }
    ids.swapAt(from, from + step)
    save(ids)
  }

  private func save(_ ids: [String]) {
    localOrder = ids
    model.onSwitcherFolderAction("reorder", "", ids.joined(separator: "\n"))
  }

  private func press(_ folder: SwitcherFolder) {
    switch mode {
    case .browse:
      show(folder)
    case .edit:
      if selection.contains(folder.id) { selection.remove(folder.id) } else { selection.insert(folder.id) }
    }
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

/// The sheet header's round button (the app's close button, as on the email sign-in sheet) at the
/// system sheet's 44pt: a filled circle,
/// not glass on glass, that dims while pressed as `.bordered` does. `.bordered` itself sizes the
/// circle from its label, so it cannot be held at an exact size.
private struct RoundButtonStyle: ButtonStyle {
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
