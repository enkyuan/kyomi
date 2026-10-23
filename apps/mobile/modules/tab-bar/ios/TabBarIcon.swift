import CoreGraphics
import SwiftUI
import UIKit

/// Vector icon geometry received from `@kyomi/ui`, parsed once when the prop
/// arrives so drawing never re-reads SVG path data.
public struct TabBarIcon {
  struct Layer {
    let path: SwiftUI.Path
    let evenOdd: Bool
    /// Stroke width in viewBox units for line glyphs, or nil for a filled path.
    let strokeWidth: CGFloat?
    /// What gets filled: the stroked outline of a line glyph (round caps and joins), or the path itself.
    /// Stroking is the expensive part of drawing an icon, so it happens once here, in viewBox
    /// units, rather than on every layout pass. A uniform scale commutes with stroking.
    let outline: SwiftUI.Path

    init(path: SwiftUI.Path, evenOdd: Bool, strokeWidth: CGFloat?) {
      self.path = path
      self.evenOdd = evenOdd
      self.strokeWidth = strokeWidth
      outline = strokeWidth.map {
        path.strokedPath(StrokeStyle(lineWidth: $0, lineCap: .round, lineJoin: .round))
      } ?? path
    }
  }

  let viewBox: CGRect
  let layers: [Layer]
  /// Transform that rotates clockwise about the viewBox centre, then re-centres the rotated glyph.
  /// A pointed glyph's bounds move when it turns, so rotating about the viewBox centre alone leaves it off-centre.
  let transform: CGAffineTransform

  public init(viewBox: String, rotation: Double = 0, paths: [(d: String, evenOdd: Bool, strokeWidth: CGFloat?)]) {
    let box = Self.parseViewBox(viewBox)
    self.viewBox = box
    layers = paths.map {
      Layer(
        path: SwiftUI.Path(SVGPathParser.path(from: $0.d)),
        evenOdd: $0.evenOdd,
        strokeWidth: $0.strokeWidth
      )
    }
    transform = Self.centeredRotation(degrees: rotation, in: box, layers: layers)
  }

  /// Rotates about the viewBox centre, then centres the rotated bounds. A pointed glyph's bounds
  /// move when it turns, so rotating about the viewBox centre alone leaves it off-centre.
  private static func centeredRotation(degrees: Double, in box: CGRect, layers: [Layer]) -> CGAffineTransform {
    guard degrees != 0 else { return .identity }
    let rotate = CGAffineTransform(translationX: box.midX, y: box.midY)
      .rotated(by: degrees * .pi / 180)
      .translatedBy(x: -box.midX, y: -box.midY)
    let bounds = layers
      .map { $0.path.applying(rotate).cgPath.boundingBoxOfPath }
      .reduce(CGRect.null) { $0.union($1) }
    guard !bounds.isNull else { return rotate }
    // Shift after rotating; `translatedBy` would apply the shift before it, inside the rotated frame.
    return rotate.concatenating(CGAffineTransform(translationX: box.midX - bounds.midX, y: box.midY - bounds.midY))
  }

  /// The glyph rasterized once into a template image `size` points square, for views that show the
  /// same icon many times (list rows). A `TabBarIconView` fills its vector outline on every render,
  /// which a scrolling list pays again for each row that appears; an image is only composited.
  public func templateImage(size: CGFloat) -> UIImage {
    let format = UIGraphicsImageRendererFormat.preferred()
    format.opaque = false
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let scale = min(size / viewBox.width, size / viewBox.height)
    let fit = CGAffineTransform(
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      tx: rect.midX - viewBox.midX * scale,
      ty: rect.midY - viewBox.midY * scale
    )
    let image = UIGraphicsImageRenderer(bounds: rect, format: format).image { context in
      let cg = context.cgContext
      cg.setFillColor(UIColor.black.cgColor)
      for layer in layers {
        cg.addPath(layer.outline.applying(transform).applying(fit).cgPath)
        cg.fillPath(using: layer.evenOdd ? .evenOdd : .winding)
      }
    }
    return image.withRenderingMode(.alwaysTemplate)
  }

  private static func parseViewBox(_ value: String) -> CGRect {
    let numbers = value
      .split(whereSeparator: { $0 == " " || $0 == "," })
      .compactMap { Double($0) }
    guard numbers.count == 4, numbers[2] > 0, numbers[3] > 0 else {
      return CGRect(x: 0, y: 0, width: 24, height: 24)
    }
    return CGRect(x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3])
  }
}

/// Draws a `TabBarIcon` aspect-fit inside a square, matching SVG's default
/// `xMidYMid meet` viewBox behavior.
public struct TabBarIconView: View {
  let icon: TabBarIcon
  let size: CGFloat
  let color: Color

  public init(icon: TabBarIcon, size: CGFloat, color: Color) {
    self.icon = icon
    self.size = size
    self.color = color
  }

  public var body: some View {
    ZStack {
      ForEach(icon.layers.indices, id: \.self) { index in
        let layer = icon.layers[index]
        ViewBoxShape(outline: layer.outline, viewBox: icon.viewBox, transform: icon.transform)
          .fill(color, style: FillStyle(eoFill: layer.evenOdd))
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

/// Scales a layer's outline into `rect`, aspect-fit like SVG's default `xMidYMid meet`.
private struct ViewBoxShape: Shape {
  let outline: SwiftUI.Path
  let viewBox: CGRect
  let transform: CGAffineTransform

  func path(in rect: CGRect) -> SwiftUI.Path {
    let scale = min(rect.width / viewBox.width, rect.height / viewBox.height)
    return outline.applying(
      transform.concatenating(
        CGAffineTransform(
          a: scale,
          b: 0,
          c: 0,
          d: scale,
          tx: rect.midX - viewBox.midX * scale,
          ty: rect.midY - viewBox.midY * scale
        )
      )
    )
  }
}

/// Converts SVG path data into a `CGPath`. Supports every SVG 1.1 path command
/// in absolute and relative form, implicit command repetition, and compact
/// number syntax such as `3.642.976` or `1-2`.
enum SVGPathParser {
  static func path(from data: String) -> CGPath {
    var scanner = Scanner(data)
    let path = CGMutablePath()
    var current = CGPoint.zero
    var subpathStart = CGPoint.zero
    var lastCubicControl: CGPoint?
    var lastQuadraticControl: CGPoint?
    var command: UInt8?

    while !scanner.isAtEnd {
      if let next = scanner.command() {
        command = next
      } else if let previous = command, previous != UInt8(ascii: "Z"), previous != UInt8(ascii: "z") {
        // A number after a command repeats it; extra moveto pairs are linetos.
        if previous == UInt8(ascii: "M") {
          command = UInt8(ascii: "L")
        } else if previous == UInt8(ascii: "m") {
          command = UInt8(ascii: "l")
        }
      } else {
        break
      }

      guard let active = command else { break }
      let relative = active >= UInt8(ascii: "a")
      let origin = relative ? current : .zero
      var cubicControl: CGPoint?
      var quadraticControl: CGPoint?

      switch active | 0x20 {
      case UInt8(ascii: "m"):
        guard let point = scanner.point(relativeTo: origin) else { return path }
        path.move(to: point)
        current = point
        subpathStart = point
      case UInt8(ascii: "l"):
        guard let point = scanner.point(relativeTo: origin) else { return path }
        path.addLine(to: point)
        current = point
      case UInt8(ascii: "h"):
        guard let x = scanner.number() else { return path }
        current = CGPoint(x: x + origin.x, y: current.y)
        path.addLine(to: current)
      case UInt8(ascii: "v"):
        guard let y = scanner.number() else { return path }
        current = CGPoint(x: current.x, y: y + origin.y)
        path.addLine(to: current)
      case UInt8(ascii: "c"):
        guard
          let control1 = scanner.point(relativeTo: origin),
          let control2 = scanner.point(relativeTo: origin),
          let end = scanner.point(relativeTo: origin)
        else { return path }
        path.addCurve(to: end, control1: control1, control2: control2)
        cubicControl = control2
        current = end
      case UInt8(ascii: "s"):
        guard
          let control2 = scanner.point(relativeTo: origin),
          let end = scanner.point(relativeTo: origin)
        else { return path }
        let control1 = lastCubicControl.map { reflect($0, about: current) } ?? current
        path.addCurve(to: end, control1: control1, control2: control2)
        cubicControl = control2
        current = end
      case UInt8(ascii: "q"):
        guard
          let control = scanner.point(relativeTo: origin),
          let end = scanner.point(relativeTo: origin)
        else { return path }
        path.addQuadCurve(to: end, control: control)
        quadraticControl = control
        current = end
      case UInt8(ascii: "t"):
        guard let end = scanner.point(relativeTo: origin) else { return path }
        let control = lastQuadraticControl.map { reflect($0, about: current) } ?? current
        path.addQuadCurve(to: end, control: control)
        quadraticControl = control
        current = end
      case UInt8(ascii: "a"):
        guard
          let rx = scanner.number(),
          let ry = scanner.number(),
          let rotation = scanner.number(),
          let largeArc = scanner.flag(),
          let sweep = scanner.flag(),
          let end = scanner.point(relativeTo: origin)
        else { return path }
        addArc(
          to: path,
          from: current,
          radii: CGSize(width: rx, height: ry),
          rotation: rotation,
          largeArc: largeArc,
          sweep: sweep,
          end: end
        )
        current = end
      case UInt8(ascii: "z"):
        path.closeSubpath()
        current = subpathStart
      default:
        return path
      }

      lastCubicControl = cubicControl
      lastQuadraticControl = quadraticControl
    }

    return path
  }

  private static func reflect(_ point: CGPoint, about center: CGPoint) -> CGPoint {
    CGPoint(x: center.x * 2 - point.x, y: center.y * 2 - point.y)
  }

  /// Appends an elliptical arc as cubic Bézier segments of at most 90°, using
  /// the endpoint-to-center conversion from the SVG implementation notes (F.6.5).
  private static func addArc(
    to path: CGMutablePath,
    from start: CGPoint,
    radii: CGSize,
    rotation: CGFloat,
    largeArc: Bool,
    sweep: Bool,
    end: CGPoint
  ) {
    guard start != end else { return }
    var rx = abs(radii.width)
    var ry = abs(radii.height)
    guard rx > 0, ry > 0 else {
      path.addLine(to: end)
      return
    }

    let phi = rotation * .pi / 180
    let cosPhi = cos(phi)
    let sinPhi = sin(phi)
    let halfDx = (start.x - end.x) / 2
    let halfDy = (start.y - end.y) / 2
    let x1 = cosPhi * halfDx + sinPhi * halfDy
    let y1 = -sinPhi * halfDx + cosPhi * halfDy

    let radiiScale = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
    if radiiScale > 1 {
      rx *= radiiScale.squareRoot()
      ry *= radiiScale.squareRoot()
    }

    let numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
    var coefficient = denominator == 0 ? 0 : max(0, numerator / denominator).squareRoot()
    if largeArc == sweep { coefficient = -coefficient }
    let centerX1 = coefficient * rx * y1 / ry
    let centerY1 = -coefficient * ry * x1 / rx
    let center = CGPoint(
      x: cosPhi * centerX1 - sinPhi * centerY1 + (start.x + end.x) / 2,
      y: sinPhi * centerX1 + cosPhi * centerY1 + (start.y + end.y) / 2
    )

    let startVector = CGPoint(x: (x1 - centerX1) / rx, y: (y1 - centerY1) / ry)
    let endVector = CGPoint(x: (-x1 - centerX1) / rx, y: (-y1 - centerY1) / ry)
    let startAngle = angle(from: CGPoint(x: 1, y: 0), to: startVector)
    var sweepAngle = angle(from: startVector, to: endVector)
    if !sweep, sweepAngle > 0 {
      sweepAngle -= 2 * .pi
    } else if sweep, sweepAngle < 0 {
      sweepAngle += 2 * .pi
    }

    let segmentCount = max(1, Int((abs(sweepAngle) / (.pi / 2)).rounded(.up)))
    let segmentAngle = sweepAngle / CGFloat(segmentCount)
    let handle = 4 / 3 * tan(segmentAngle / 4)

    func pointOnEllipse(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      let scaledX = rx * x
      let scaledY = ry * y
      return CGPoint(
        x: cosPhi * scaledX - sinPhi * scaledY + center.x,
        y: sinPhi * scaledX + cosPhi * scaledY + center.y
      )
    }

    var theta = startAngle
    for segment in 0..<segmentCount {
      let nextTheta = theta + segmentAngle
      let control1 = pointOnEllipse(cos(theta) - handle * sin(theta), sin(theta) + handle * cos(theta))
      let control2 = pointOnEllipse(
        cos(nextTheta) + handle * sin(nextTheta),
        sin(nextTheta) - handle * cos(nextTheta)
      )
      let segmentEnd = segment == segmentCount - 1 ? end : pointOnEllipse(cos(nextTheta), sin(nextTheta))
      path.addCurve(to: segmentEnd, control1: control1, control2: control2)
      theta = nextTheta
    }
  }

  private static func angle(from u: CGPoint, to v: CGPoint) -> CGFloat {
    let dot = u.x * v.x + u.y * v.y
    let length = (u.x * u.x + u.y * u.y).squareRoot() * (v.x * v.x + v.y * v.y).squareRoot()
    guard length > 0 else { return 0 }
    let value = acos(min(1, max(-1, dot / length)))
    return u.x * v.y - u.y * v.x < 0 ? -value : value
  }

  private struct Scanner {
    private let bytes: [UInt8]
    private var index = 0

    init(_ data: String) {
      bytes = Array(data.utf8)
    }

    var isAtEnd: Bool {
      mutating get {
        skipSeparators()
        return index >= bytes.count
      }
    }

    mutating func command() -> UInt8? {
      skipSeparators()
      guard index < bytes.count else { return nil }
      let byte = bytes[index]
      guard Self.commands.contains(byte) else { return nil }
      index += 1
      return byte
    }

    mutating func point(relativeTo origin: CGPoint) -> CGPoint? {
      guard let x = number(), let y = number() else { return nil }
      return CGPoint(x: x + origin.x, y: y + origin.y)
    }

    mutating func number() -> CGFloat? {
      skipSeparators()
      let start = index
      if index < bytes.count, bytes[index] == UInt8(ascii: "-") || bytes[index] == UInt8(ascii: "+") {
        index += 1
      }
      var hasDigits = false
      var hasDecimalPoint = false
      while index < bytes.count {
        let byte = bytes[index]
        if Self.isDigit(byte) {
          hasDigits = true
          index += 1
        } else if byte == UInt8(ascii: "."), !hasDecimalPoint {
          // A second decimal point starts the next number, as in `3.642.976`.
          hasDecimalPoint = true
          index += 1
        } else {
          break
        }
      }
      guard hasDigits else {
        index = start
        return nil
      }
      if index < bytes.count, bytes[index] == UInt8(ascii: "e") || bytes[index] == UInt8(ascii: "E") {
        var exponentEnd = index + 1
        if exponentEnd < bytes.count,
          bytes[exponentEnd] == UInt8(ascii: "-") || bytes[exponentEnd] == UInt8(ascii: "+")
        {
          exponentEnd += 1
        }
        if exponentEnd < bytes.count, Self.isDigit(bytes[exponentEnd]) {
          index = exponentEnd
          while index < bytes.count, Self.isDigit(bytes[index]) { index += 1 }
        }
      }
      return Double(String(decoding: bytes[start..<index], as: UTF8.self)).map { CGFloat($0) }
    }

    /// Arc flags are single characters and may be written without separators.
    mutating func flag() -> Bool? {
      skipSeparators()
      guard index < bytes.count else { return nil }
      switch bytes[index] {
      case UInt8(ascii: "0"):
        index += 1
        return false
      case UInt8(ascii: "1"):
        index += 1
        return true
      default:
        return nil
      }
    }

    private mutating func skipSeparators() {
      while index < bytes.count, Self.separators.contains(bytes[index]) {
        index += 1
      }
    }

    private static func isDigit(_ byte: UInt8) -> Bool {
      byte >= UInt8(ascii: "0") && byte <= UInt8(ascii: "9")
    }

    private static let separators: Set<UInt8> = [0x20, 0x09, 0x0A, 0x0D, 0x0C, UInt8(ascii: ",")]
    private static let commands = Set("MmLlHhVvCcSsQqTtAaZz".utf8)
  }
}
