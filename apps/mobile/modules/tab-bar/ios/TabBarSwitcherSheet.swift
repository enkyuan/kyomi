import SwiftUI

/// The sheet the switcher opens. It is presented with a zoom transition from the tab capsule, so
/// the bar's glass grows into the sheet and the sheet shrinks back into the bar on dismissal.
/// Folders and feeds are not loaded on mobile yet, so it shows the empty state for now.
struct TabBarSwitcherSheet: View {
  let switcher: TabBarSwitcher
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      ContentUnavailableView(
        "No Sources Yet",
        systemImage: "folder",
        description: Text("Folders and feeds you follow will appear here.")
      )
      .navigationTitle(switcher.title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) { dismiss() }
        }
      }
    }
    // Opens at half height over the content; pull up for the full sheet.
    .presentationDetents([.medium, .large])
  }
}
