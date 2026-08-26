import ExpoModulesCore
import UIKit

/// Thin bridge between JS and the native overlay. Decodes call arguments into
/// [ToastModel]s, drives [ToastManager], and emits lifecycle events back to JS.
///
/// The Expo Modules API runs async functions on a background queue unless they
/// explicitly opt into `.main`. All UI work below is therefore main-queued.
public class LiquidToastsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidToasts")

    // Single event carrying the wire-ready payload; JS routes by `id`, exactly
    // like the Flutter event channel did.
    Events("onToastEvent")

    OnCreate {
      // Install the (empty) overlay eagerly so SwiftUI has rendered the container
      // before the first `show` — otherwise the first toast appears as initial
      // content and skips its entrance transition.
      Task { @MainActor [weak self] in
        ToastOverlayHost.shared.ensureInstalled()
        self?.wireEvents()
      }
    }

    /// Flushes any state left over from a previous JS context. Native flushes
    /// **unconditionally** on every handshake, which is what clears stale toasts
    /// after a fast-refresh / reload (the old JS listener is gone, so those
    /// toasts must be dropped silently).
    AsyncFunction("handshake") { (_: String) in
      MainActor.assumeIsolated {
        let host = ToastOverlayHost.shared
        self.wireEvents()
        host.manager.flushAll()
        host.ensureInstalled()
      }
    }.runOnQueue(.main)

    AsyncFunction("configure") { (args: [String: Any]) in
      MainActor.assumeIsolated {
        let manager = ToastOverlayHost.shared.manager
        if let value = args.int("maxVisible") { manager.maxVisible = max(1, value) }
        if let value = args.int("maxQueue") { manager.maxQueue = max(1, value) }
        if let policy = args["dropPolicy"] as? String { manager.dropOldest = policy != "dropNewest" }
        if let safeArea = args["safeArea"] as? [String: Any] {
          let next = ToastSafeAreaInsets(
            top: safeArea.cgFloat("top") ?? 0,
            left: safeArea.cgFloat("left") ?? 0,
            bottom: safeArea.cgFloat("bottom") ?? 0,
            right: safeArea.cgFloat("right") ?? 0
          )
          if manager.customSafeArea != next { manager.customSafeArea = next }
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("show") { (args: [String: Any]) -> [String: Any] in
      try MainActor.assumeIsolated {
        let host = ToastOverlayHost.shared
        host.ensureInstalled()
        guard let model = ToastModel(arguments: args) else {
          throw InvalidArgumentsException("show: missing id/message")
        }
        host.manager.present(model, imageData: Self.imageData(args["image"]))
        return [
          "id": model.id,
          "accepted": true,
          "capability": [
            "dynamicIslandOriginUsed": false,
            "glassMode": Capabilities.glassModeString,
          ],
        ]
      }
    }.runOnQueue(.main)

    AsyncFunction("update") { (args: [String: Any]) -> [String: Any] in
      try MainActor.assumeIsolated {
        guard let id = args["id"] as? String, let model = ToastModel(arguments: args) else {
          throw InvalidArgumentsException("update: missing id/message")
        }
        let applied = ToastOverlayHost.shared.manager.update(
          id: id, with: model, imageData: Self.imageData(args["image"]))
        var res: [String: Any] = ["id": id, "applied": applied]
        if !applied { res["reason"] = "unknown_id" }
        return res
      }
    }.runOnQueue(.main)

    AsyncFunction("dismiss") { (id: String) -> [String: Any] in
      MainActor.assumeIsolated {
        let ok = ToastOverlayHost.shared.manager.dismiss(id: id, reason: "manual")
        var res: [String: Any] = ["id": id, "dismissed": ok]
        if !ok { res["reason"] = "unknown_id" }
        return res
      }
    }.runOnQueue(.main)

    AsyncFunction("dismissAll") { (reason: String?) -> [String: Any] in
      MainActor.assumeIsolated {
        let ids = ToastOverlayHost.shared.manager.dismissAll(reason: reason ?? "dismissAll")
        return ["dismissedIds": ids]
      }
    }.runOnQueue(.main)

    AsyncFunction("finishAction") { (id: String) in
      MainActor.assumeIsolated {
        ToastOverlayHost.shared.manager.finishAction(id: id)
      }
    }.runOnQueue(.main)

    /// Simulates an action-button tap (drives the spinner + lifecycle). Used by
    /// demos/tests that can't synthesize a real touch.
    AsyncFunction("debugTriggerAction") { (id: String) in
      MainActor.assumeIsolated {
        ToastOverlayHost.shared.manager.handleAction(id: id)
      }
    }.runOnQueue(.main)

    AsyncFunction("queryGeometry") { () -> [String: Any] in
      MainActor.assumeIsolated {
        DynamicIslandGeometry.geometrySnapshot(ToastOverlayHost.activeWindow())
      }
    }.runOnQueue(.main)
  }

  /// Points the manager's event callback at this module instance's JS emitter.
  /// Re-wired on handshake so a reloaded JS context gets a live sink.
  @MainActor
  private func wireEvents() {
    ToastOverlayHost.shared.manager.onEvent = { [weak self] payload in
      self?.sendEvent("onToastEvent", payload)
    }
  }

  /// Decodes the base64 image payload. JS has no byte-array type over the
  /// bridge, so the leading image crosses as base64 and is decoded here (the
  /// actual bitmap decode still happens off-main in `ToastImageDecoder`).
  private static func imageData(_ value: Any?) -> Data? {
    guard let base64 = value as? String, !base64.isEmpty else { return nil }
    return Data(base64Encoded: base64)
  }
}

private final class InvalidArgumentsException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}
