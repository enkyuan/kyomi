import SwiftUI
import UIKit

/// Adaptive glass surface for a toast.
///
/// - iOS 26+: native, un-tinted Liquid Glass via `glassEffect`, with only a
///   light neutral scrim for text contrast over changing content.
/// - iOS 17–25: a frosted `.thickMaterial` fallback with a matching light
///   neutral density wash.
/// - Reduce Transparency: an opaque custom or neutral surface.
struct GlassBackground<S: Shape>: View {
  let shape: S
  /// Surface color from `ToastStyleOverride.background`. Nil keeps the neutral,
  /// adaptive material on every tier.
  var surfaceTint: Color? = nil

  /// Ceiling on the tint alpha for the translucent (glass / frosted) tiers.
  /// Above this, `glassEffect(.tint:)` flips the material to its heavy, opaque
  /// weight and the surface stops reading as glass. The opaque Reduce
  /// Transparency tier is exempt (it *should* be solid).
  static var maxGlassTintAlpha: CGFloat { 0.5 }
  /// The iOS 17–25 fallback needs a small neutral density wash for legibility.
  /// In dark mode this is a *light* frost: a black wash would only deepen the
  /// content behind it and make the container look clear.
  static func neutralDensityAlpha(isDark: Bool) -> CGFloat { isDark ? 0.08 : 0.04 }
  /// Liquid Glass keeps refraction intentionally vivid even with a tint. A thin
  /// neutral scrim sits above it so the toast has the softer, frostier plane
  /// needed for reliable content contrast without becoming a colored card.
  static func frostedScrimAlpha(isDark: Bool) -> CGFloat { isDark ? 0.04 : 0.02 }

  @Environment(\.colorScheme) private var scheme
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

  /// Clamps a surface tint's alpha to [maxGlassTintAlpha] (leaving already-
  /// translucent tints untouched) so colored glass stays translucent.
  private func translucentTint(_ color: Color) -> Color {
    let alpha = UIColor(color).cgColor.alpha
    guard alpha > Self.maxGlassTintAlpha else { return color }
    return color.opacity(Self.maxGlassTintAlpha / alpha)
  }

  private func resolvedTranslucentTint(isDark: Bool) -> Color {
    if let surfaceTint { return translucentTint(surfaceTint) }
    return (isDark ? Color.white : Color.black).opacity(Self.neutralDensityAlpha(isDark: isDark))
  }

  private func frostedScrim(isDark: Bool) -> Color {
    guard surfaceTint == nil else { return .clear }
    return (isDark ? Color.white : Color.black).opacity(Self.frostedScrimAlpha(isDark: isDark))
  }

  private func resolvedOpaqueSurface(isDark: Bool) -> Color {
    if let surfaceTint { return surfaceTint }
    return isDark ? Color(white: 0.20) : Color(white: 0.96)
  }

  var body: some View {
    let isDark = scheme == .dark
    if reduceTransparency {
      shape
        .fill(resolvedOpaqueSurface(isDark: isDark))
        .overlay(shape.stroke(Color.primary.opacity(0.08), lineWidth: 0.5))
        .shadow(color: .black.opacity(isDark ? 0.4 : 0.14), radius: 14, y: 6)
    } else {
      glass(isDark: isDark)
    }
  }

  @ViewBuilder
  private func glass(isDark: Bool) -> some View {
    #if compiler(>=6.2)
    if #available(iOS 26.0, *) {
      shape
        .fill(.clear)
        .glassEffect(resolvedGlass(), in: shape)
        .overlay(shape.fill(frostedScrim(isDark: isDark)))
        // Explicit shadow: the entrance animates opacity/scale/offset on top of
        // this glass, which forces SwiftUI to rasterize it and suppresses the
        // glass's *system* ambient shadow mid-animation (it dips out, then snaps
        // back on settle). Our own shadow is a normal primitive that fades and
        // scales smoothly with the entrance, so the visible shadow stays
        // continuous instead of flickering.
        .shadow(color: .black.opacity(isDark ? 0.24 : 0.08), radius: 10, y: 4)
    } else {
      frosted(isDark: isDark)
    }
    #else
    frosted(isDark: isDark)
    #endif
  }

  /// The `Glass` style for the toast surface.
  ///
  /// Caller backgrounds are capped ([translucentTint]) so opaque colors remain
  /// glass-like. The default lets the system's regular material provide depth;
  /// it never assigns a semantic status pigment to the surface.
  #if compiler(>=6.2)
  @available(iOS 26.0, *)
  private func resolvedGlass() -> Glass {
    guard let surfaceTint else { return .regular }
    return .regular.tint(translucentTint(surfaceTint))
  }
  #endif

  @ViewBuilder
  private func frosted(isDark: Bool) -> some View {
    let wash = resolvedTranslucentTint(isDark: isDark)
    shape
      .fill(.thickMaterial)
      .overlay(shape.fill(wash))
      .overlay(shape.stroke(Color.white.opacity(isDark ? 0.10 : 0.30), lineWidth: 0.5))
      .shadow(color: .black.opacity(isDark ? 0.35 : 0.12), radius: 16, y: 8)
  }
}
