import SwiftUI

extension View {
  @ViewBuilder
  func glassSurface<S: Shape>(
    in shape: S
  ) -> some View {
    if #available(iOS 26.0, *) {
      glassEffect(
        .regular.interactive(),
        in: shape
      )
    } else {
      background(
        .ultraThinMaterial,
        in: shape
      )
      .overlay(
        shape.stroke(
          Color.white.opacity(0.14),
          lineWidth: 1
        )
      )
    }
  }
}
