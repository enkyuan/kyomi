import SwiftUI
import UIKit

/// Kyomi's floating tab bar, laid out like the iOS 26 system bar: a search button at the leading
/// edge, a Liquid Glass capsule of tabs and the narrower switcher centred between the buttons, and
/// a matcha add button at the trailing edge. Searching grows the search button's own glass into the
/// field while the add button turns into the close button; the capsule dematerializes meanwhile and
/// materializes again on close. Minimizing hides the capsule and leaves only the two buttons; the
/// switcher grows the capsule's glass into a sheet, with a sheet's detents, drag, dimming and
/// dismissal, and contracts it back.
struct TabBarContent: View {
  @Bindable var model: TabBarModel
  @FocusState private var searchFocused: Bool
  @State private var sheetDetent = SwitcherSheetDetent.medium
  /// The field's glyph and text arrive a beat after its glass has started to grow, and leave with
  /// the glass at once on close, so nothing cross-fades with the tabs coming back.
  @State private var searchContentVisible = false
  /// Vertical drag on the open sheet; its top edge follows the finger 1:1.
  @State private var sheetDrag: CGFloat = 0
  /// VoiceOver lands on the sheet's title as it opens.
  @AccessibilityFocusState private var sheetTitleFocused: Bool
  /// Ties each glass shape to an identity so a hidden one materializes in and out, as the
  /// system tab bar's glass does, instead of fading its content over a stuck glass layer.
  @Namespace private var glassNamespace
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private nonisolated static let coordinateSpace = "KyomiTabBar"
  private static let inactiveIconColor = Color.primary.opacity(0.72)
  private static let actionIconColor = Color.primary.opacity(0.82)
  private static let searchFieldIconColor = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 0x98 / 255, green: 0x98 / 255, blue: 0x9D / 255, alpha: 1)
        : UIColor(red: 0x8E / 255, green: 0x8E / 255, blue: 0x93 / 255, alpha: 1)
    }
  )
  /// Search grows the search button's glass into the field, and the user can reverse it
  /// mid-flight; a spring retargets from the glass's current frame instead of restarting. A tap
  /// carries no momentum, so it does not overshoot. With Reduce Motion the glass takes its new
  /// shape at once and only the field's content fades in (`searchContentAnimation`).
  private var transition: Animation? {
    reduceMotion ? nil : .spring(duration: 0.38, bounce: 0)
  }
  private var searchContentAnimation: Animation? {
    searchContentVisible ? .easeOut(duration: reduceMotion ? 0.15 : 0.2).delay(reduceMotion ? 0 : 0.08) : nil
  }
  /// One shape for the capsule and the sheet, so the glass only changes frame as it morphs: corners
  /// that follow the display's where they meet them, never tighter than the capsule's, or the
  /// sheet's top corners once it opens. Only the minimum changes, so the corners animate with it.
  private static func glassShape(sheet presented: Bool) -> ConcentricRectangle {
    let minimum = presented ? TabBarMetrics.sheetCornerRadius : TabBarMetrics.cornerRadius
    return ConcentricRectangle(corners: .concentric(minimum: .fixed(minimum)))
  }
  /// What a system sheet turns into at its large detent: opaque, on the elevated background.
  private static let sheetBackground = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark ? .secondarySystemBackground : .systemBackground
    }
  )
  /// The sheet's content follows the glass in, a beat behind, and leaves first on the way back.
  private static let sheetContentTransition = AnyTransition.asymmetric(
    insertion: .opacity.animation(.easeOut(duration: 0.2).delay(0.08)),
    removal: .opacity.animation(.easeOut(duration: 0.1))
  )

  /// Opening and closing the sheet. Critically damped springs in the range of the system's sheet
  /// motion, closing a touch faster than opening; a release hands over its velocity. With Reduce
  /// Motion the glass takes its new shape at once and only the content and dimming fade.
  private func sheetAnimation(opening: Bool, initialVelocity: Double = 0, thrown: Bool = false) -> Animation? {
    if reduceMotion { return nil }
    return .interpolatingSpring(
      duration: opening ? 0.38 : 0.3,
      bounce: thrown ? 0.12 : 0,
      initialVelocity: initialVelocity
    )
  }

  /// Minimizing follows scroll direction, which changes often and mid-motion, so it uses a short,
  /// critically damped spring: it responds at once, never overshoots, and retargets from its
  /// current value when the scroll reverses (bounce is reserved for momentum from a flick).
  private var minimizeTransition: Animation {
    reduceMotion ? .easeOut(duration: 0.16) : .spring(duration: 0.28, bounce: 0)
  }

  var body: some View {
    GeometryReader { proxy in
      let layout = TabBarLayout(
        containerSize: proxy.size,
        tabCount: model.tabs.count,
        hasSwitcher: model.switcher != nil,
        minimized: model.minimized,
        searchActive: model.searchActive,
        reduceMotion: reduceMotion,
        sheetPresented: model.switcherPresented
      )
      let sheet = SwitcherSheetGeometry(container: proxy.size, safeTop: model.safeTop)

      ZStack(alignment: .topLeading) {
        scrim(sheet)

        // One container so the glass shapes render together and morph as they move.
        GlassEffectContainer(spacing: 0) {
          ZStack(alignment: .topLeading) {
            // The capsule stays mounted while minimized and only its glass and glyphs go away.
            // Inserting and removing it on every scroll reversal left interrupted removal
            // transitions of the same glass identity in flight, which the container morphed into
            // the add button, chevron and all. Searching is a discrete choice, so it does remove
            // the capsule: under its own glass identity it materializes out beside the field's
            // glass and back in on close, and its glyphs travel with the glass instead of
            // cross-fading with the field.
            if !model.searchActive {
              let capsuleFrame = model.switcherPresented
                ? sheet.frame(top: sheet.top(sheetDetent, drag: sheetDrag))
                : layout.mainRect
              capsule(layout, sheet: sheet, frame: capsuleFrame)
                .onGeometryChange(for: CGRect.self) { proxy in
                  proxy.frame(in: .named(Self.coordinateSpace))
                } action: { frame in
                  model.mainFrame = frame
                }
                .glassEffectID("capsule", in: glassNamespace)
                .glassEffectTransition(.materialize)
                .position(x: capsuleFrame.midX, y: capsuleFrame.midY)
            }

            // The search button and the field share one glass identity, so the button's glass
            // grows into the field from the leading edge and contracts back into the button.
            if layout.showsSearchButton {
              Group {
                if model.searchActive {
                  searchField(layout)
                } else {
                  searchButton(layout)
                }
              }
              .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .named(Self.coordinateSpace))
              } action: { frame in
                model.actionFrame = frame
              }
              .glassEffectID("search", in: glassNamespace)
              .glassEffectTransition(.materialize)
              .position(x: layout.searchRect.midX, y: layout.searchRect.midY)
            }

            // One button turns from add into close and back: the glass loses its tint and the plus
            // turns a quarter of the way round into a cross.
            if layout.showsTrailing {
              trailingButton(layout)
                .onGeometryChange(for: CGRect.self) { proxy in
                  proxy.frame(in: .named(Self.coordinateSpace))
                } action: { frame in
                  model.addFrame = frame
                }
                .glassEffectID("trailing", in: glassNamespace)
                .glassEffectTransition(.materialize)
                .position(x: layout.addX + layout.buttonSize / 2, y: layout.barMidY)
            }
          }
        }
        .frame(width: proxy.size.width, height: proxy.size.height)
      }
    }
    .coordinateSpace(.named(Self.coordinateSpace))
    .animation(minimizeTransition, value: model.minimized)
    .animation(transition, value: model.searchActive)
    .onChange(of: model.searchActive) { _, active in
      searchContentVisible = active
      if !active { searchFocused = false }
    }
    .sensoryFeedback(.impact(weight: .light), trigger: model.pressFeedback)
    .accessibilityElement(children: .contain)
    .accessibilityAddTraits(.isTabBar)
  }

  /// Dims the screen behind the open sheet, lighter as it is dragged down. Tapping it dismisses the
  /// sheet, as tapping outside a system sheet does.
  private func scrim(_ sheet: SwitcherSheetGeometry) -> some View {
    let dimming = sheet.dimming(top: sheet.top(sheetDetent, drag: sheetDrag))
    return Color.black
      .opacity(model.switcherPresented ? TabBarMetrics.sheetScrimOpacity * dimming : 0)
      .animation(reduceMotion ? .easeOut(duration: 0.2) : nil, value: model.switcherPresented)
      .contentShape(.rect)
      .onTapGesture { dismissSheet(sheet) }
      .allowsHitTesting(model.switcherPresented)
      .accessibilityHidden(true)
  }

  /// The capsule's glass, which is also the sheet's: one view whose frame and content change, so
  /// opening and closing are the glass itself moving, with nothing handed between two surfaces.
  private func capsule(_ layout: TabBarLayout, sheet: SwitcherSheetGeometry, frame: CGRect) -> some View {
    let compact = !layout.showsMain
    let presented = model.switcherPresented

    return ZStack(alignment: .top) {
      // The tabs keep their size on the bar's band as the glass grows away from them, and fade.
      tabs(layout)
        .frame(width: layout.mainWidth, height: layout.barHeight)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .opacity(presented ? 0 : 1)
        .allowsHitTesting(!presented)
        .accessibilityHidden(presented)

      // Glass at the medium detent, opaque at the large one, crossing over as the sheet is dragged
      // between them, and back to glass as it contracts into the capsule. Drawn inside the glass,
      // so the glass itself is never faded; always mounted, so its opacity animates with the frame.
      Self.sheetBackground
        .opacity(presented ? sheet.largeProgress(top: frame.minY) : 0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)

      if presented, let switcher = model.switcher {
        TabBarSwitcherSheet(title: switcher.title, focus: $sheetTitleFocused) { dismissSheet(sheet) }
          .transition(Self.sheetContentTransition)
      }
    }
    .frame(width: frame.width, height: frame.height)
    .clipShape(Self.glassShape(sheet: presented))
    // Minimizing shrinks and fades the glyphs inside the glass; the glass itself dematerializes
    // below. Opacity and scale applied outside `glassEffect` reach the glyphs but not the glass a
    // container renders, which left a shrunken capsule behind with the chevron outside it.
    .scaleEffect(compact && !reduceMotion ? 0.86 : 1)
    .opacity(compact ? 0 : 1)
    // `identity` keeps the capsule mounted while it has no glass, so a quick scroll reversal
    // retargets the same view instead of stacking an interrupted removal under a new insertion.
    // The switcher sheet never touches the capsule: it stays beneath the sheet, like the system tab
    // bar under any sheet, so its glass is never rebuilt for it.
    // The sheet is not a control, so its glass does not react to touches like the bar's.
    .glassEffect(compact ? .identity : presented ? .regular : .regular.interactive(), in: Self.glassShape(sheet: presented))
    .gesture(sheetDragGesture(sheet, capsuleTop: layout.mainRect.minY), isEnabled: presented)
    .allowsHitTesting(!compact)
    .accessibilityHidden(compact)
    .accessibilityAddTraits(presented ? .isModal : [])
    .accessibilityAction(.escape) { dismissSheet(sheet) }
  }

  private func presentSheet() {
    withAnimation(sheetAnimation(opening: true)) {
      sheetDetent = .medium
      sheetDrag = 0
      model.switcherPresented = true
    }
    sheetTitleFocused = true
  }

  /// Contracts the sheet back into the capsule, carrying on at `initialVelocity` (relative to the
  /// distance left) when a release hands one over.
  private func dismissSheet(_ sheet: SwitcherSheetGeometry, initialVelocity: Double = 0) {
    guard model.switcherPresented else { return }
    withAnimation(sheetAnimation(opening: false, initialVelocity: initialVelocity)) {
      sheetDrag = 0
      model.switcherPresented = false
    }
  }

  /// A sheet's drag: the top edge follows the finger, then the release settles where the drag was
  /// heading (projected from its velocity), at the finger's speed: the other detent, back to this
  /// one, or dismissed into the capsule.
  private func sheetDragGesture(_ sheet: SwitcherSheetGeometry, capsuleTop: CGFloat) -> some Gesture {
    DragGesture(minimumDistance: 6, coordinateSpace: .named(Self.coordinateSpace))
      .onChanged { sheetDrag = $0.translation.height }
      .onEnded { value in
        let current = sheet.top(sheetDetent, drag: sheetDrag)
        let projected = sheet.top(sheetDetent) + value.predictedEndTranslation.height
        let velocity = value.velocity.height
        let mediumTop = sheet.top(.medium)

        if projected > mediumTop + (sheet.bottom - mediumTop) * TabBarMetrics.sheetDismissRatio {
          let distance = capsuleTop - current
          dismissSheet(sheet, initialVelocity: abs(distance) > 1 ? velocity / distance : 0)
          return
        }
        let target: SwitcherSheetDetent =
          abs(projected - sheet.top(.large)) < abs(projected - mediumTop) ? .large : .medium
        let distance = sheet.top(target) - current
        withAnimation(
          sheetAnimation(
            opening: true,
            initialVelocity: abs(distance) > 1 ? velocity / distance : 0,
            thrown: abs(velocity) > TabBarMetrics.sheetFlickVelocity
          )
        ) {
          sheetDetent = target
          sheetDrag = 0
        }
      }
  }

  /// The tabs share one segmented control, which supplies the selection lens. The switcher sits
  /// beside the control rather than in it: it opens another screen instead of selecting a tab, so
  /// the lens, which means "this is where you are", must never land on it. Its glyph is still
  /// drawn on the glass like the tab glyphs, so the row reads as one set of icons.
  private func tabs(_ layout: TabBarLayout) -> some View {
    HStack(spacing: 0) {
      ZStack {
        TabSelector(
          segmentWidths: layout.segmentWidths,
          height: layout.segmentHeight,
          selectedIndex: model.selectedIndex,
          onSelect: { model.select($0) }
        )
        .accessibilityHidden(true)

        HStack(spacing: 0) {
          ForEach(Array(model.tabs.enumerated()), id: \.element.id) { index, tab in
            let isSelected = index == model.selectedIndex
            TabBarIconView(
              icon: isSelected ? tab.selectedIcon : tab.icon,
              size: TabBarMetrics.tabIconSize,
              color: isSelected ? model.activeTint : Self.inactiveIconColor
            )
            .frame(width: layout.segmentWidths[index], height: layout.segmentHeight)
            .accessibilityElement()
            .accessibilityLabel(tab.label)
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
            .accessibilityAction { model.select(index) }
          }
        }
        .allowsHitTesting(false)
      }
      .frame(width: layout.segmentsWidth, height: layout.segmentHeight)

      if let switcher = model.switcher, layout.switcherWidth > 0 {
        switcherButton(switcher, width: layout.switcherWidth, layout: layout)
      }
    }
  }

  private func switcherButton(_ switcher: TabBarSwitcher, width: CGFloat, layout: TabBarLayout) -> some View {
    Button {
      presentSheet()
    } label: {
      TabBarIconView(
        icon: switcher.icon,
        size: TabBarMetrics.switcherIconSize,
        color: Self.inactiveIconColor
      )
      .frame(width: width, height: layout.segmentHeight)
      .contentShape(.rect)
    }
    // The capsule's interactive glass already answers the touch; a second dip on the glyph doubled it.
    .buttonStyle(.plain)
    .accessibilityLabel(switcher.label)
    .accessibilityHint(switcher.hint)
  }

  private func searchField(_ layout: TabBarLayout) -> some View {
    HStack(spacing: TabBarMetrics.searchFieldSpacing) {
      searchGlyph(size: TabBarMetrics.searchIconSize, color: Self.searchFieldIconColor)
        .frame(width: TabBarMetrics.searchFieldIconWidth)
        .accessibilityHidden(true)

      TextField(model.searchPlaceholder, text: $model.searchQuery)
        .focused($searchFocused)
        .submitLabel(.search)
        .onSubmit {
          model.submitSearch()
          searchFocused = false
        }
        .onAppear { searchFocused = true }
    }
    .padding(.horizontal, TabBarMetrics.searchFieldPadding)
    .opacity(searchContentVisible ? 1 : 0)
    .animation(searchContentAnimation, value: searchContentVisible)
    .frame(width: layout.searchRect.width, height: layout.searchRect.height)
    .glassEffect(.regular, in: Self.glassShape(sheet: false))
  }

  @ViewBuilder
  private func searchGlyph(size: CGFloat, color: Color) -> some View {
    if let icon = model.searchIcon {
      TabBarIconView(icon: icon, size: size, color: color)
    } else {
      Image(systemName: "magnifyingglass")
        .font(.system(size: size))
        .foregroundStyle(color)
    }
  }

  private func searchButton(_ layout: TabBarLayout) -> some View {
    Button {
      model.toggleSearch()
    } label: {
      searchGlyph(size: TabBarMetrics.searchIconSize, color: Self.actionIconColor)
        .scaleEffect(layout.buttonScale)
        .frame(width: layout.buttonSize, height: layout.buttonSize)
      .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.interactive(), in: .circle)
    .accessibilityLabel("Search articles")
  }

  private func trailingButton(_ layout: TabBarLayout) -> some View {
    let searching = model.searchActive
    return Button {
      if searching { model.toggleSearch() } else { model.pressAdd() }
    } label: {
      Group {
        if let icon = model.addIcon {
          TabBarIconView(
            icon: icon,
            size: TabBarMetrics.addIconSize,
            color: searching ? Self.actionIconColor : model.addIconColor
          )
        } else {
          Image(systemName: "plus")
            .font(.system(size: TabBarMetrics.addIconSize, weight: .semibold))
            .foregroundStyle(searching ? Self.actionIconColor : model.addIconColor)
        }
      }
      .rotationEffect(.degrees(searching ? 45 : 0))
      .scaleEffect(layout.buttonScale)
      .frame(width: layout.buttonSize, height: layout.buttonSize)
      .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.tint(searching ? nil : model.activeTint).interactive(), in: .circle)
    .accessibilityLabel(searching ? "Close search" : "Add")
  }
}
