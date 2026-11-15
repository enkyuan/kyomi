import SwiftUI

/// What the switcher sheet shows, drawn inside the capsule's glass once it has grown into the
/// sheet: a header with the title and the close button, a row of flat chips that edit the folders,
/// then the folders themselves. It brings no background of its own; the glass is the sheet.
/// Everything that changes a folder is reported to JavaScript, which owns the data.
struct TabBarSwitcherSheet: View {
  let model: TabBarModel
  let switcher: TabBarSwitcher
  let focus: AccessibilityFocusState<Bool>.Binding
  let onClose: () -> Void
  let onOpenFolder: (String) -> Void

  /// What pressing a folder does. `edit` offers to delete it, `rename` to rename it.
  private enum Mode {
    case browse, edit, rename
  }

  /// The chips' icons are stroked as heavy as their label's strokes (`.subheadline`, medium, is about
  /// 1.5pt thick), so icon and text read as one weight.
  private static let chipIconSize: CGFloat = 18
  private static let chipIconStroke: CGFloat = 1.75

  /// How far down from the chips a scrolled list fades to clear.
  private static let topFadeHeight: CGFloat = 28

  @State private var mode = Mode.browse
  @State private var topFade: CGFloat = 0
  @State private var draft = ""
  @State private var isCreating = false
  @State private var renaming: SwitcherFolder?
  @State private var deleting: SwitcherFolder?

  var body: some View {
    VStack(spacing: 0) {
      // The close button sits the same distance from the sheet's top and side edges, as on a system
      // sheet, so it is concentric with the sheet's corner; the title centres on the same line.
      ZStack {
        Text(switcher.title)
          .font(.headline)
          .lineLimit(1)
          .accessibilityAddTraits(.isHeader)
          .accessibilityFocused(focus)
        HStack {
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
    .alert("New folder", isPresented: $isCreating) {
      TextField("Name", text: $draft)
      Button("Cancel", role: .cancel) {}
      Button("Create") { commit(.create) }
    }
    .alert("Rename folder", isPresented: isRenaming) {
      TextField("Name", text: $draft)
      Button("Cancel", role: .cancel) {}
      Button("Rename") { commit(.rename) }
    }
    .alert(
      "Delete \u{201C}\(deleting?.name ?? "")\u{201D}?",
      isPresented: isDeleting
    ) {
      Button("Cancel", role: .cancel) {}
      Button("Delete", role: .destructive) {
        if let deleting { model.onSwitcherFolderAction("delete", deleting.id, "") }
      }
    } message: {
      Text("Its feeds stay followed and move to Unsorted.")
    }
    // Leaving the last folder behind leaves nothing to edit.
    .onChange(of: model.switcherFolders.isEmpty) { _, isEmpty in
      if isEmpty { mode = .browse }
    }
  }

  // MARK: Chips

  /// Edit, rename and add as flat chips.
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
        mode = mode == .edit ? .browse : .edit
      }
      chip("Rename", icon: switcher.renameIcon, isOn: mode == .rename, isEnabled: !model.switcherFolders.isEmpty) {
        mode = mode == .rename ? .browse : .rename
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
      HStack(spacing: 6) {
        TabBarIconView(
          icon: icon.stroked(toPoints: Self.chipIconStroke, iconSize: Self.chipIconSize),
          size: Self.chipIconSize,
          color: isOn ? model.activeTint : .primary
        )
        Text(title)
          .font(.subheadline.weight(.medium))
          .lineLimit(1)
          .fixedSize(horizontal: true, vertical: false)
      }
      .foregroundStyle(isOn ? model.activeTint : .primary)
      .padding(.horizontal, 12)
      .frame(height: 36)
    }
    .buttonStyle(ChipButtonStyle(isOn: isOn, tint: model.activeTint))
    .disabled(!isEnabled)
    .opacity(isEnabled ? 1 : 0.4)
    .accessibilityAddTraits(isOn ? .isSelected : [])
  }

  // MARK: Folders

  private var folderList: some View {
    ScrollView {
      LazyVStack(spacing: 0) {
        ForEach(model.switcherFolders) { folder in
          row(folder)
        }
      }
      .padding(.horizontal, TabBarMetrics.sheetCloseInset)
      .padding(.bottom, TabBarMetrics.sheetCloseInset)
    }
    // The list is clipped where it meets the chips, which cuts a row mid-glyph in a hard line. A
    // mask that fades the top edge to clear softens that cut. Its height follows the scroll offset,
    // so at rest, with the first row against the chips, nothing is faded.
    .onScrollGeometryChange(for: CGFloat.self) { geometry in
      min(max(geometry.contentOffset.y + geometry.contentInsets.top, 0), Self.topFadeHeight)
    } action: { _, fade in
      topFade = fade
    }
    .mask(alignment: .top) {
      VStack(spacing: 0) {
        LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom)
          .frame(height: topFade)
        Rectangle()
      }
    }
  }

  private func row(_ folder: SwitcherFolder) -> some View {
    Button { press(folder) } label: {
      HStack(spacing: 12) {
        // Browsing shows the name alone; edit and rename mark each row with what pressing it does.
        if mode == .edit {
          Image(systemName: "minus.circle.fill")
            .font(.title3)
            .foregroundStyle(.red)
        }
        // The feed count rides the name's cap height as a superscript.
        Text("\(Text(folder.name))\(Text(" \(folder.feedCount)").font(.caption).monospacedDigit().baselineOffset(10).foregroundStyle(.secondary))")
          .font(.title3)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
        if mode == .rename {
          Image(systemName: "pencil")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.tertiary)
        }
      }
      .frame(minHeight: 52)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    // A row leaving under the chips blurs and fades in proportion to how much of it has left, so
    // the list softens into its top edge. Nothing is drawn over the list, so the edge has no seam.
    .scrollTransition(topLeading: .interactive, bottomTrailing: .identity, axis: .vertical) { content, phase in
      content
        .blur(radius: 10 * max(0, -phase.value))
        .opacity(1 + min(0, phase.value))
    }
    .accessibilityLabel(folder.name)
    .accessibilityValue("\(folder.feedCount) feeds")
    .accessibilityHint(hint)
  }

  private var hint: String {
    switch mode {
    case .browse: "Opens the feeds in this folder"
    case .edit: "Deletes this folder"
    case .rename: "Renames this folder"
    }
  }

  private func press(_ folder: SwitcherFolder) {
    switch mode {
    case .browse:
      onOpenFolder(folder.id)
    case .edit:
      deleting = folder
    case .rename:
      draft = folder.name
      renaming = folder
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
    Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })
  }
}

/// A flat chip: a tertiary fill, or the active tint when on, that dims while pressed like the close
/// button.
private struct ChipButtonStyle: ButtonStyle {
  let isOn: Bool
  let tint: Color

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .background(isOn ? AnyShapeStyle(tint.opacity(0.2)) : AnyShapeStyle(.fill.tertiary), in: .capsule)
      .contentShape(.capsule)
      .opacity(configuration.isPressed ? 0.5 : 1)
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
