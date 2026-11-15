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

/// Reports, each display frame, how far the bar has got between its resting state and the reader's tools.
///
/// The system animates the reader's view during a push, pop or swipe back, so that view's on-screen
/// presence (slid in from the side or bottom, times its opacity) is the transition's own progress,
/// scrubbed by a finger and springing back on a cancel. Reading it needs no JS, bridge or prop update.
/// The reader is found by the identifier its root view carries, so other screens' transitions are ignored.
@MainActor
final class ReaderTransitionTracker {
  /// The test ID of the reader's root view (`READER_SCREEN_ID`); iOS exposes it as the accessibility identifier.
  static let screenIdentifier = "kyomi.reader.screen"
  /// Views searched for the identifier per screen, so a list below the reader is never walked.
  private static let searchBudget = 160

  private let model: TabBarModel
  private weak var host: UIView?
  private var link: CADisplayLink?
  private weak var readerController: UIViewController?
  private var inTransition = false
  /// Presence at the previous frame, for the lookahead.
  private var lastPresence: Double?
  /// When the tools arrived, and whether a pop has finished: the tools outlive the screen until JS unmounts it.
  private var activeSince: CFAbsoluteTime = 0
  private var afterPop = false
  /// Screens already found to be the reader.
  private let readers = NSHashTable<UIViewController>.weakObjects()

  /// A reader shown without a transition (first screen, replace) takes the reader's state after this long.
  private static let noTransitionGrace: CFTimeInterval = 0.5
  /// The bar draws a frame after it is measured, so the measure is moved on by one frame of motion.
  private static let lookaheadFrames = 1.0

  init(model: TabBarModel, host: UIView) {
    self.model = model
    self.host = host
  }

  func start() {
    guard link == nil else { return }
    let target = DisplayLinkTarget(self)
    let link = CADisplayLink(target: target, selector: #selector(DisplayLinkTarget.tick))
    link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  func stop() {
    link?.invalidate()
    link = nil
    readerController = nil
    inTransition = false
    lastPresence = nil
  }

  func readerActiveChanged(_ active: Bool) {
    if active {
      activeSince = CFAbsoluteTimeGetCurrent()
    } else {
      afterPop = false
    }
  }

  fileprivate func tick() {
    guard let window = host?.window else { return }

    if let transition = readerTransition(in: window.rootViewController) {
      let first = !inTransition
      inTransition = true
      readerController = transition.reader
      let moving = transition.moving ?? transition.reader.view!
      let presence = Self.presence(of: moving, in: transition.context.containerView)
      // The transition's first sample can be taken before the system has positioned the screen, so it
      // reads as fully present; it is skipped, and the next one starts the motion.
      if first { return }
      // Move on by a frame's worth of the motion just seen, so the frame this draws lines up with the
      // screen's rather than the one before it. A jump of more than half is not motion to extend.
      let ahead = lastPresence.map { abs(presence - $0) > 0.5 ? presence : presence + (presence - $0) * Self.lookaheadFrames } ?? presence
      lastPresence = presence
      model.setReaderMorph(ahead)
      return
    }

    lastPresence = nil
    if inTransition {
      // It ended. A reader that is still on screen (a push, or a swipe that was cancelled) is the bar;
      // one that has been removed is gone, and JavaScript is about to drop its tools.
      inTransition = false
      let onScreen = readerController?.viewIfLoaded?.window != nil
      afterPop = !onScreen
      model.setReaderMorph(onScreen ? 1 : 0)
      readerController = nil
      return
    }

    // Nothing is moving: the bar is at rest, in whichever state the reader is.
    if !model.readerActive {
      if model.readerMorph != 0 { model.setReaderMorph(0) }
    } else if !afterPop, model.readerMorph < 1,
      CFAbsoluteTimeGetCurrent() - activeSince > Self.noTransitionGrace
    {
      model.setReaderMorph(1)
    }
  }

  /// How present the reader is in the transition's container, 0 to 1: how far it is from its resting
  /// place along each axis, and how opaque. The system slides a wrapper (a card view) several levels
  /// above the screen's own view, which stays put, so this takes the largest offset among the
  /// ancestors up to the container. Read from presentation layers, where the animation has got to.
  private static func presence(of view: UIView, in container: UIView) -> Double {
    var across: CGFloat = 0
    var down: CGFloat = 0
    var opacity: Float = 1
    var cursor: UIView? = view
    while let current = cursor, current !== container {
      let layer = current.layer.presentation() ?? current.layer
      across = max(across, abs(layer.frame.minX))
      down = max(down, abs(layer.frame.minY))
      opacity = min(opacity, layer.opacity)
      cursor = current.superview
    }
    let bounds = container.bounds
    return (1 - min(1, Double(across / max(1, bounds.width)))) * (1 - min(1, Double(down / max(1, bounds.height)))) * Double(opacity)
  }

  /// The transition the reader's screen is in, if any: the stack that holds the reader is a UIKit
  /// navigation controller somewhere in the view controller tree, and a transition counts only when the
  /// reader is one of the two screens it moves between.
  private func readerTransition(
    in root: UIViewController?
  ) -> (context: UIViewControllerTransitionCoordinatorContext, reader: UIViewController, moving: UIView?)? {
    guard let root else { return nil }
    if let navigation = root as? UINavigationController, let coordinator = navigation.transitionCoordinator {
      for (controllerKey, viewKey) in [
        (UITransitionContextViewControllerKey.from, UITransitionContextViewKey.from),
        (.to, .to),
      ] {
        if let screen = coordinator.viewController(forKey: controllerKey), isReader(screen) {
          // The view the system moves inside its container; the screen's own view stays put.
          return (coordinator, screen, coordinator.view(forKey: viewKey))
        }
      }
    }
    for child in root.children {
      if let found = readerTransition(in: child) { return found }
    }
    return readerTransition(in: root.presentedViewController)
  }

  private func isReader(_ controller: UIViewController) -> Bool {
    if readers.contains(controller) { return true }
    guard let root = controller.viewIfLoaded else { return false }
    var queue = [root]
    var visited = 0
    while !queue.isEmpty, visited < Self.searchBudget {
      let view = queue.removeFirst()
      visited += 1
      if view.accessibilityIdentifier == Self.screenIdentifier {
        readers.add(controller)
        return true
      }
      queue.append(contentsOf: view.subviews)
    }
    return false
  }
}

/// `CADisplayLink` holds its target strongly, so the tracker is reached through a weak hop. A display
/// link fires on the main run loop it was added to, so the target is main-actor isolated outright.
@MainActor
private final class DisplayLinkTarget: NSObject {
  private weak var tracker: ReaderTransitionTracker?

  init(_ tracker: ReaderTransitionTracker) {
    self.tracker = tracker
  }

  @objc func tick() {
    tracker?.tick()
  }
}
