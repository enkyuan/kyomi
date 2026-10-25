import SwiftUI

/// What the switcher sheet shows, drawn inside the capsule's glass once it has grown into the
/// sheet: a header with the title and the close button, a row of glass chips that edit the folders,
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

  @State private var mode = Mode.browse
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

  /// Edit, rename and add as glass chips that merge where they touch.
  private var chips: some View {
    GlassEffectContainer(spacing: 8) {
      HStack(spacing: 8) {
        chip("Edit", icon: switcher.editIcon, isOn: mode == .edit, isEnabled: !model.switcherFolders.isEmpty) {
          mode = mode == .edit ? .browse : .edit
        }
        chip("Rename", icon: switcher.renameIcon, isOn: mode == .rename, isEnabled: !model.switcherFolders.isEmpty) {
          mode = mode == .rename ? .browse : .rename
        }
        chip("Add", icon: switcher.addIcon, isOn: false, isEnabled: true) {
          draft = ""
          isCreating = true
        }
        Spacer(minLength: 0)
      }
    }
  }

  private func chip(
    _ title: String, icon: TabBarIcon, isOn: Bool, isEnabled: Bool, action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      HStack(spacing: 6) {
        TabBarIconView(icon: icon, size: 18, color: isOn ? model.activeTint : .primary)
        Text(title).font(.subheadline.weight(.medium))
      }
      .foregroundStyle(isOn ? model.activeTint : .primary)
      .padding(.horizontal, 14)
      .frame(height: 36)
      .contentShape(.capsule)
    }
    .buttonStyle(.plain)
    .glassEffect(
      isOn ? .regular.tint(model.activeTint.opacity(0.25)).interactive() : .regular.interactive(),
      in: .capsule
    )
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
          if folder != model.switcherFolders.last {
            Divider().padding(.leading, 44)
          }
        }
      }
      .padding(.horizontal, TabBarMetrics.sheetCloseInset)
      .padding(.bottom, TabBarMetrics.sheetCloseInset)
    }
  }

  private func row(_ folder: SwitcherFolder) -> some View {
    Button { press(folder) } label: {
      HStack(spacing: 12) {
        Image(systemName: mode == .edit ? "minus.circle.fill" : "folder")
          .font(.title3)
          .foregroundStyle(mode == .edit ? AnyShapeStyle(.red) : AnyShapeStyle(.secondary))
          .frame(width: 32)
        Text(folder.name)
          .font(.body)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text("\(folder.feedCount)")
          .font(.subheadline)
          .monospacedDigit()
          .foregroundStyle(.secondary)
        Image(systemName: mode == .rename ? "pencil" : "chevron.right")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.tertiary)
          .opacity(mode == .edit ? 0 : 1)
      }
      .frame(minHeight: 52)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
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
