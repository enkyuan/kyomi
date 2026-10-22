import UIKit

/// What the list ends in while the next page loads: a spinner centred below the last row. It is a
/// plain UIKit view, since a SwiftUI host would cost more than the one glyph it draws.
final class ArticleListFooterView: UICollectionReusableView {
  private let spinner = UIActivityIndicatorView(style: .medium)

  override init(frame: CGRect) {
    super.init(frame: frame)
    spinner.translatesAutoresizingMaskIntoConstraints = false
    spinner.hidesWhenStopped = false
    addSubview(spinner)
    // The padding sizes the footer: the layout measures it from these constraints.
    NSLayoutConstraint.activate([
      spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
      spinner.topAnchor.constraint(equalTo: topAnchor, constant: 20),
      spinner.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -20),
    ])
    isAccessibilityElement = true
    accessibilityLabel = "Loading more articles"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func setColor(_ color: UIColor) {
    spinner.color = color
  }

  // A spinner stops when it leaves the screen; a reused footer starts it again.
  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { spinner.startAnimating() }
  }
}
