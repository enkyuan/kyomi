import ExpoModulesCore
import UIKit

struct IconMenuItemRecord: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var checked: Bool = false
  @Field var icon: IconRecord = IconRecord()
}

/// A circular Liquid Glass button that opens a native `UIMenu` whose items carry Blode glyphs
/// (rasterized from the same path data as the tab bar's icons). Being a real `UIButton` with a menu as
/// its primary action, it keeps the system's interactive glass, morphing menu and haptics.
/// A checked item shows a checkmark in the glyph's place.
final class IconMenuView: ExpoView {
  private let button = UIButton(type: .custom)
  private let onSelect = EventDispatcher()
  private static let glyphSize: CGFloat = 20

  var items: [IconMenuItemRecord] = [] {
    didSet { rebuildMenu() }
  }

  /// SF Symbol name for the button's glyph.
  var symbol: String? {
    didSet { restyle() }
  }

  var tint: UIColor? {
    didSet { restyle() }
  }

  private static let triggerGlyphSize: CGFloat = 18

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.frame = bounds
    button.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    button.showsMenuAsPrimaryAction = true
    addSubview(button)
    restyle()
  }

  private func restyle() {
    var configuration = UIButton.Configuration.glass()
    configuration.cornerStyle = .capsule
    configuration.image = symbol.flatMap {
      UIImage(systemName: $0, withConfiguration: UIImage.SymbolConfiguration(pointSize: Self.triggerGlyphSize, weight: .medium))
    }
    configuration.baseForegroundColor = tint ?? .label
    button.configuration = configuration
  }

  private func rebuildMenu() {
    let actions = items.map { item -> UIAction in
      let image = item.checked
        ? UIImage(systemName: "checkmark")
        : item.icon.icon.stroked(toPoints: 1.75, iconSize: Self.glyphSize).templateImage(size: Self.glyphSize)
      return UIAction(title: item.title, image: image) { [weak self] _ in
        self?.onSelect(["id": item.id])
      }
    }
    button.menu = UIMenu(children: actions)
  }
}
