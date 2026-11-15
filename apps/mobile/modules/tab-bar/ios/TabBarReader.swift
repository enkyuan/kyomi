import SwiftUI

/// The reader bar's tools, drawn on the capsule's glass in the tabs' place. Each is a plain button:
/// the capsule's interactive glass already answers the touch, and a tool that is on (a saved
/// article, the reader view, the open size panel) swaps to its filled symbol and takes the tint.
struct TabBarReaderTools: View {
  let model: TabBarModel
  let segmentWidth: CGFloat
  let height: CGFloat
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    HStack(spacing: 0) {
      ForEach(model.readerTools) { tool in
        // The size tool is on while its panel is open; the others report their own state.
        let isOn = tool.id == "textSize" ? model.fontPanelPresented : tool.isSelected
        Button {
          model.pressReaderTool(tool.id)
        } label: {
          // Outline to filled is the same glyph changing state, so the two cross-fade in place
          // (quickly, ease-out) rather than one arriving as a new view.
          ZStack {
            TabBarIconView(icon: tool.icon, size: TabBarMetrics.tabIconSize, color: Color.primary.opacity(0.72))
              .opacity(isOn ? 0 : 1)
            TabBarIconView(icon: tool.selectedIcon, size: TabBarMetrics.tabIconSize, color: tool.selectedTint ?? model.activeTint)
              .opacity(isOn ? 1 : 0)
          }
          .animation(reduceMotion ? nil : .easeOut(duration: 0.15), value: isOn)
          .frame(width: segmentWidth, height: height)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(!tool.isEnabled)
        .opacity(tool.isEnabled ? 1 : 0.35)
        .accessibilityLabel(tool.label)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
      }
    }
  }
}

/// The text size slider, floating one gap above the reader bar on its own Liquid Glass: the
/// `textformat` symbol at the leading end, a slider that steps by one point, and the size at the
/// trailing end. The digits are tabular, so the value never nudges the slider as it changes, and they
/// roll to the new number in the direction of the change.
struct TabBarFontPanel: View {
  @Bindable var model: TabBarModel
  let rect: CGRect
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    let size = Int(model.readerFontSize)

    HStack(spacing: 12) {
      Image(systemName: "textformat")
        .font(.system(size: 17, weight: .medium))
        .foregroundStyle(Color.primary.opacity(0.72))
        .frame(width: TabBarMetrics.fontPanelSideWidth, alignment: .leading)
        .accessibilityHidden(true)

      Slider(
        value: Binding(
          get: { model.readerFontSize },
          set: { model.setReaderFontSize($0) }
        ),
        in: model.readerFontRange,
        step: 1,
        onEditingChanged: { model.setFontSizeEditing($0) }
      )
      .tint(model.activeTint)
      .accessibilityLabel(model.readerFontLabel)
      .accessibilityValue("\(size) points")

      Text("\(size)")
        .font(.system(size: 17, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(Color.primary.opacity(0.82))
        .contentTransition(.numericText(value: model.readerFontSize))
        // Interruptible and bounce-free: a fast drag retargets the roll instead of queueing it.
        .animation(reduceMotion ? nil : .snappy(duration: 0.18), value: model.readerFontSize)
        .frame(width: TabBarMetrics.fontPanelSideWidth, alignment: .trailing)
        .accessibilityHidden(true)
    }
    .padding(.horizontal, TabBarMetrics.fontPanelInset)
    .frame(width: rect.width, height: rect.height)
    .glassEffect(.regular, in: .capsule)
  }
}


/// The system share controller, hosted as a sheet's content so SwiftUI can present it with a matched
/// transition from the capsule. It is Apple's own controller, not a lookalike.
struct TabBarShareSheet: UIViewControllerRepresentable {
  let url: URL
  let onFinish: () -> Void

  func makeUIViewController(context: Context) -> UIActivityViewController {
    let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
    controller.completionWithItemsHandler = { _, _, _, _ in onFinish() }
    return controller
  }

  func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
