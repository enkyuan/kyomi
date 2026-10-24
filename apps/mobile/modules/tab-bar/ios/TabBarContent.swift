import SwiftUI
import UIKit

/// Kyomi's floating tab bar, laid out like the iOS 26 system bar: a search button at the leading
/// edge, a Liquid Glass capsule of tabs and the narrower switcher centred between the buttons, and
/// a matcha add button at the trailing edge. Searching widens the search button's own glass into the
/// field while the add button turns into the close button; the capsule dematerializes meanwhile and
/// materializes again on close. Minimizing hides the capsule and leaves only the two buttons; the
/// switcher grows the capsule's glass into a sheet, with a sheet's detents, drag, dimming and
/// dismissal, and contracts it back.
struct TabBarContent: View {
  @Bindable var model: TabBarModel
  @State private var searchFocused = false
  @State private var composerFocused = false
  @State private var sheetDetent = SwitcherSheetDetent.medium
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
  /// Search widens the search button's glass into the field, and the user can reverse it
  /// mid-flight; a spring retargets from the glass's current frame instead of restarting. A tap
  /// carries no momentum, so it does not overshoot. With Reduce Motion the glass takes its new
  /// shape at once and only the field's text fades in (`searchFieldTransition`).
  private var transition: Animation? {
    reduceMotion ? nil : .spring(duration: 0.38, bounce: 0)
  }
  /// The field's text arrives a beat after its glass has started to widen and leaves ahead of it,
  /// so nothing cross-fades with the tabs coming back.
  private var searchFieldTransition: AnyTransition {
    .asymmetric(
      insertion: .opacity.animation(.easeOut(duration: reduceMotion ? 0.15 : 0.2).delay(reduceMotion ? 0 : 0.08)),
      removal: .opacity.animation(.easeOut(duration: 0.1))
    )
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
  /// The capsule's glyphs clear quickly when it leaves, so none shows through the translucent search
  /// field growing over it. A plain fade: the glass materializes on its own, and any scale or offset
  /// here would read as the bar drifting.
  private static let capsuleTransition = AnyTransition.asymmetric(
    insertion: .opacity,
    removal: .opacity.animation(.easeOut(duration: 0.1))
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
      // The keyboard shrinks the proxy, so the full container is its size plus the keyboard's rise.
      let keyboardInset = proxy.safeAreaInsets.bottom
      let container = CGSize(width: proxy.size.width, height: proxy.size.height + keyboardInset)
      let layout = TabBarLayout(
        containerSize: container,
        tabCount: model.tabs.count,
        hasSwitcher: model.switcher != nil,
        minimized: model.minimized,
        searchActive: model.searchActive,
        composing: model.composerActive,
        reduceMotion: reduceMotion,
        sheetPresented: model.switcherPresented,
        keyboardInset: keyboardInset
      )
      let sheet = SwitcherSheetGeometry(container: container, safeTop: model.safeTop)

      ZStack(alignment: .topLeading) {
        scrim(sheet)

        // The composer's results sit behind the bar, over the screen it blurs.
        if model.composerActive {
          TabBarComposer(
            model: model,
            container: container,
            fieldTop: layout.searchRect.minY,
            safeTop: model.safeTop
          )
          .transition(.opacity)
        }

        // One container so the glass shapes render together and morph as they move.
        GlassEffectContainer(spacing: 0) {
          ZStack(alignment: .topLeading) {
            // Minimizing and searching remove the capsule and closing brings it back, as the
            // documented way to make a glass effect leave a `GlassEffectContainer`: inserting or
            // removing the view animates its glass with `glassEffectTransition`, which acts only on
            // hierarchy changes. `materialize` keeps it from pairing with the search field's glass
            // and morphing the tabs into the field. The open sheet is the capsule's own glass, so
            // it stays mounted while presented.
            if layout.showsMain || model.switcherPresented {
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
                .transition(Self.capsuleTransition)
                .position(x: capsuleFrame.midX, y: capsuleFrame.midY)
            }

            // The open sheet covers both buttons' places; they materialize out into its glass.
            if layout.showsButtons {
              // The search button and the field are one view, so its glass widens from the
              // leading edge and narrows back with nothing inserted or removed to be matched up.
              // The add composer's field is the same view: it takes the field's place and the
              // keyboard, with its own text.
              searchSurface(layout)
                .onGeometryChange(for: CGRect.self) { proxy in
                  proxy.frame(in: .named(Self.coordinateSpace))
                } action: { frame in
                  model.actionFrame = frame
                }
                .glassEffectID("search", in: glassNamespace)
                .glassEffectTransition(.materialize)
                .position(x: layout.searchRect.midX, y: layout.searchRect.midY)

              // One surface for the add button and the close button beside the field, so each is
              // the same glass changing frame, and none is inserted or removed.
              trailingSurface(layout)
                .onGeometryChange(for: CGRect.self) { proxy in
                  proxy.frame(in: .named(Self.coordinateSpace))
                } action: { frame in
                  model.addFrame = frame
                }
                .glassEffectID("trailing", in: glassNamespace)
                .glassEffectTransition(.materialize)
                .position(x: layout.trailingRect.midX, y: layout.trailingRect.midY)
            }
          }
        }
        .frame(width: container.width, height: container.height)
      }
    }
    .coordinateSpace(.named(Self.coordinateSpace))
    .animation(minimizeTransition, value: model.minimized)
    .animation(transition, value: model.searchActive)
    .animation(transition, value: model.composerActive)
    // Opening search focuses the field. It mounts while its text is still fading in, and a view
    // that is not visible yet can refuse focus, so ask again once the fade is under way. Closing
    // drops the keyboard with the glass.
    .task(id: model.searchActive) {
      guard model.searchActive else {
        searchFocused = false
        return
      }
      searchFocused = true
      try? await Task.sleep(for: .milliseconds(200))
      if model.searchActive { searchFocused = true }
    }
    // The composer's field takes focus the same way once its text is on its way in.
    .task(id: model.composerActive) {
      guard model.composerActive else {
        composerFocused = false
        return
      }
      composerFocused = true
      try? await Task.sleep(for: .milliseconds(200))
      if model.composerActive { composerFocused = true }
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
    // The sheet is not a control, so its glass does not react to touches like the bar's.
    .glassEffect(presented ? .regular : .regular.interactive(), in: Self.glassShape(sheet: presented))
    .gesture(sheetDragGesture(sheet, capsuleTop: layout.mainRect.minY), isEnabled: presented)
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
          ForEach(model.tabs.indices, id: \.self) { index in
            let tab = model.tabs[index]
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

  /// A capsule as wide as it is tall is the search button; widened, it is the field, which takes
  /// either search's query or the add composer's, since both are the same native field. The glyph
  /// keeps the button's centre in both, so it never slides, and the field's text sits beside it. The
  /// glass is interactive only as a button.
  private func searchSurface(_ layout: TabBarLayout) -> some View {
    let searching = model.searchActive
    let composing = model.composerActive
    let fielding = searching || composing
    let rect = layout.searchRect
    let glyphScale = fielding ? TabBarMetrics.fieldHeight / TabBarMetrics.height : layout.buttonScale
    return ZStack(alignment: .leading) {
      if searching {
        TabBarField(
          text: $model.searchQuery,
          focused: $searchFocused,
          placeholder: model.searchPlaceholder
        ) {
          model.submitSearch()
          searchFocused = false
        }
        .padding(.leading, TabBarMetrics.fieldTextInset)
        .padding(.trailing, TabBarMetrics.fieldTextTrailing)
        .transition(searchFieldTransition)
      } else if composing {
        HStack(spacing: 8) {
          TabBarField(
            text: $model.composerQuery,
            focused: $composerFocused,
            placeholder: "Search or paste a feed address",
            returnKey: .go,
            keyboard: .webSearch
          ) {
            model.submitComposer()
          }
          if model.composerStatus == .loading {
            ProgressView()
          }
        }
        .padding(.leading, TabBarMetrics.fieldTextInset)
        .padding(.trailing, TabBarMetrics.fieldTextTrailing)
        .transition(searchFieldTransition)
      }

      Button {
        model.toggleSearch()
      } label: {
        searchGlyph(fielding ? Self.searchFieldIconColor : Self.actionIconColor)
          .scaleEffect(glyphScale)
          .frame(width: rect.height, height: rect.height)
          .contentShape(.circle)
      }
      .buttonStyle(.plain)
      .allowsHitTesting(!fielding)
      .accessibilityLabel("Search articles")
      .accessibilityHidden(fielding)
    }
    .frame(width: rect.width, height: rect.height, alignment: .leading)
    .clipShape(.capsule)
    .glassEffect(fielding ? .regular : .regular.interactive(), in: .capsule)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(composing ? "Add a feed" : "")
    .accessibilityAction(.escape) { if composing { model.toggleComposer() } }
  }

  @ViewBuilder
  private func searchGlyph(_ color: Color) -> some View {
    if let icon = model.searchIcon {
      TabBarIconView(icon: icon, size: TabBarMetrics.searchIconSize, color: color)
    } else {
      Image(systemName: "magnifyingglass")
        .font(.system(size: TabBarMetrics.searchIconSize))
        .foregroundStyle(color)
    }
  }

  /// The add button; beside the field it is the close button, the system's circular glass button
  /// with an X. The plus and the X cross-fade rather than turning into each other.
  private func trailingSurface(_ layout: TabBarLayout) -> some View {
    let searching = model.searchActive
    let closing = searching || model.composerActive
    let rect = layout.trailingRect

    return Button {
      if searching { model.toggleSearch() } else { model.toggleComposer() }
    } label: {
      ZStack {
        Group {
          if let icon = model.addIcon {
            TabBarIconView(icon: icon, size: TabBarMetrics.addIconSize, color: model.addIconColor)
          } else {
            Image(systemName: "plus")
              .font(.system(size: TabBarMetrics.addIconSize, weight: .semibold))
              .foregroundStyle(model.addIconColor)
          }
        }
        .scaleEffect(layout.buttonScale)
        .opacity(closing ? 0 : 1)

        Image(systemName: "xmark")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(Self.actionIconColor)
          .opacity(closing ? 1 : 0)
      }
      .frame(width: rect.width, height: rect.height)
      .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(searching ? "Close search" : closing ? "Close" : "Add feed")
    .frame(width: rect.width, height: rect.height)
    .clipShape(.capsule)
    .glassEffect(.regular.tint(closing ? nil : model.activeTint).interactive(), in: .capsule)
  }
}
