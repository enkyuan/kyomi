package expo.modules.liquidtoasts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/**
 * The surface behind a toast. Deliberately **opaque** on Android — there is no
 * Liquid Glass and no blur-behind; the default fill mirrors iOS
 * `GlassBackground.swift`'s denser neutral material (dark `0xFF383838` /
 * light `0xFFF0F0F0`). Android has no Liquid Glass or blur-behind, so this
 * stronger neutral container is the platform-equivalent way to make the toast
 * feel less transparent without assigning semantic status colors to its surface.
 * A caller-supplied [backgroundArgb] (`ToastStyleOverride.background`) replaces
 * the default. The 0.5dp white hairline keeps the surface legible as raised
 * material.
 *
 * The shadow uses `Modifier.shadow(elevation)`, which approximates the iOS
 * `.shadow(radius:16,y:8)` — Compose elevation shadows are ambient+key, not a
 * single soft blur, so this is a deliberate visual approximation rather than an
 * exact port of the iOS shadow parameters.
 */
@Composable
internal fun ToastSurface(
    cornerRadiusDp: Float,
    isDark: Boolean,
    modifier: Modifier = Modifier,
    backgroundArgb: Int? = null,
) {
    val shape = RoundedCornerShape(cornerRadiusDp.dp)
    val fill = backgroundArgb?.let { Color(it) } ?: neutralSurface(isDark)
    // Shadow first (drawn outside the clip), then the clipped surface fill.
    val base = modifier
        .shadow(elevation = 16.dp, shape = shape, clip = false)
        .clip(shape)

    Canvas(base.fillMaxSize()) {
        drawRect(fill)
        drawHairline(isDark, cornerRadiusDp)
    }
}

/** A neutral, opaque equivalent of the iOS frosted glass surface. */
private fun neutralSurface(isDark: Boolean): Color =
    if (isDark) Color(0xFF383838) else Color(0xFFF0F0F0)

/** The 0.5dp white hairline stroke (alpha 0.10 dark / 0.30 light), following the shape. */
private fun DrawScope.drawHairline(isDark: Boolean, cornerRadiusDp: Float) {
    val strokePx = 0.5.dp.toPx()
    val inset = strokePx / 2f
    val radiusPx = (cornerRadiusDp.dp.toPx() - inset).coerceAtLeast(0f)
    drawRoundRect(
        color = Color.White.copy(alpha = if (isDark) 0.10f else 0.30f),
        topLeft = Offset(inset, inset),
        size = Size(size.width - inset * 2, size.height - inset * 2),
        cornerRadius = CornerRadius(radiusPx, radiusPx),
        style = Stroke(width = strokePx),
    )
}
