import ExpoModulesCore
import UIKit

public class ScreenShapeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScreenShape")

    AsyncFunction("getBottomCornerRadii") { () -> [String: Double]? in
      MainActor.assumeIsolated {
        guard let window = Self.activeWindow() else { return nil }
        guard let radius = Self.resolvedCornerRadius(in: window), radius > 0 else { return nil }

        return [
          "bottomLeft": radius,
          "bottomRight": radius,
        ]
      }
    }.runOnQueue(.main)
  }

  @MainActor
  private static func activeWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)
  }

  /// UIKit 26 resolves `.containerConcentric()` from the actual window geometry.
  /// Asking a transparent, full-window probe for its resolved layer radius avoids
  /// private device-model tables and keeps the result correct for future hardware.
  @MainActor
  private static func resolvedCornerRadius(in window: UIWindow) -> CGFloat? {
    guard #available(iOS 26.0, *) else { return nil }

    let probe = UIView(frame: window.bounds)
    probe.backgroundColor = .clear
    probe.isUserInteractionEnabled = false
    probe.cornerConfiguration = .uniformCorners(radius: .containerConcentric())
    window.addSubview(probe)
    defer { probe.removeFromSuperview() }
    window.layoutIfNeeded()
    return probe.layer.cornerRadius
  }
}
