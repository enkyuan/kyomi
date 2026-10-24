import SwiftUI

/// What the switcher sheet shows, drawn inside the capsule's glass once it has grown into the
/// sheet: a header with the title and the close button, then the sources. It brings no background
/// of its own; the glass is the sheet. Folders and feeds are not loaded on mobile yet, so it shows
/// the empty state for now.
struct TabBarSwitcherSheet: View {
  let title: String
  let focus: AccessibilityFocusState<Bool>.Binding
  let onClose: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      // The close button sits the same distance from the sheet's top and side edges, as on a system
      // sheet, so it is concentric with the sheet's corner; the title centres on the same line.
      ZStack {
        Text(title)
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

      ContentUnavailableView(
        "No Sources Yet",
        systemImage: "folder",
        description: Text("Folders and feeds you follow will appear here.")
      )
      .frame(maxHeight: .infinity)
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
