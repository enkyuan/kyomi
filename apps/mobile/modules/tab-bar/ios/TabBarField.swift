import SwiftUI
import UIKit

/// The system's text field, with its own font, placeholder, caret and clear button, drawn on the bar's
/// glass: SwiftUI's `TextField` has no clear button. It has no background or border and no magnifier
/// of its own; the bar's glyph stands in the field's leading edge, so it can stay put as the glass widens.
struct TabBarField: UIViewRepresentable {
  @Binding var text: String
  @Binding var focused: Bool
  let placeholder: String
  var returnKey = UIReturnKeyType.search
  var keyboard = UIKeyboardType.default
  var onSubmit: () -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }

  func makeUIView(context: Context) -> UITextField {
    let field = UITextField()
    field.delegate = context.coordinator
    field.borderStyle = .none
    field.backgroundColor = .clear
    field.font = .preferredFont(forTextStyle: .body)
    field.adjustsFontForContentSizeCategory = true
    field.clearButtonMode = .whileEditing
    field.autocapitalizationType = .none
    field.autocorrectionType = .no
    field.spellCheckingType = .no
    field.returnKeyType = returnKey
    field.keyboardType = keyboard
    field.setContentHuggingPriority(.defaultLow, for: .horizontal)
    field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    field.addTarget(context.coordinator, action: #selector(Coordinator.editingChanged(_:)), for: .editingChanged)
    return field
  }

  func updateUIView(_ field: UITextField, context: Context) {
    context.coordinator.parent = self
    if field.placeholder != placeholder { field.placeholder = placeholder }
    // Leave the text alone while an input method is composing it.
    if field.text != text, field.markedTextRange == nil { field.text = text }
    if focused, !field.isFirstResponder {
      DispatchQueue.main.async { field.becomeFirstResponder() }
    } else if !focused, field.isFirstResponder {
      DispatchQueue.main.async { field.resignFirstResponder() }
    }
  }

  func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextField, context: Context) -> CGSize? {
    CGSize(width: proposal.width ?? 200, height: uiView.intrinsicContentSize.height)
  }

  @MainActor
  final class Coordinator: NSObject, UITextFieldDelegate {
    var parent: TabBarField

    init(_ parent: TabBarField) {
      self.parent = parent
    }

    @objc func editingChanged(_ field: UITextField) {
      let text = field.text ?? ""
      if parent.text != text { parent.text = text }
    }

    func textFieldDidBeginEditing(_ field: UITextField) {
      if !parent.focused { parent.focused = true }
    }

    func textFieldDidEndEditing(_ field: UITextField) {
      if parent.focused { parent.focused = false }
    }

    func textFieldShouldReturn(_ field: UITextField) -> Bool {
      parent.onSubmit()
      return false
    }

    func textFieldShouldClear(_ field: UITextField) -> Bool {
      parent.text = ""
      return true
    }
  }
}
