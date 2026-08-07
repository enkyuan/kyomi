package expo.modules.screenshape

import android.os.Build
import android.view.RoundedCorner
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScreenShapeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenShape")

    AsyncFunction("getBottomCornerRadii") {
      val activity = appContext.activityProvider?.currentActivity
      val insets = activity?.window?.decorView?.rootWindowInsets

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || activity == null || insets == null) null
      else {
        val density = activity.resources.displayMetrics.density
        val bottomLeft = insets
          .getRoundedCorner(RoundedCorner.POSITION_BOTTOM_LEFT)
          ?.radius
          ?.div(density)
          ?.toDouble()
        val bottomRight = insets
          .getRoundedCorner(RoundedCorner.POSITION_BOTTOM_RIGHT)
          ?.radius
          ?.div(density)
          ?.toDouble()

        if (bottomLeft == null || bottomRight == null) null
        else mapOf("bottomLeft" to bottomLeft, "bottomRight" to bottomRight)
      }
    }
  }
}
