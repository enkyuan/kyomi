package expo.modules.liquidtoasts

import android.app.Activity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

private class InvalidArgumentsException(message: String) :
    CodedException("ERR_INVALID_ARGS", message, null)

/**
 * The JS bridge — the Android analog of `LiquidToastsModule.swift`. Decodes call
 * arguments into [ToastModel]s, drives the [ToastManager], and emits lifecycle
 * events back to JS. The Expo Modules API dispatches these handlers on the main
 * thread, so UI is touched directly.
 *
 * State ownership:
 *  - a [ToastManager] + its embedded [DeadlineScheduler] (wired via `onExpire`);
 *  - a main-confined [CoroutineScope] (SupervisorJob + Main.immediate), cancelled
 *    on destroy;
 *  - a [ProcessLifecycleOwner] observer mapping ON_STOP/ON_START to the manager's
 *    background/foreground sweep;
 *  - an [OverlayHost] installed eagerly (so the first toast gets its entrance)
 *    and rebuilt across activity changes while the manager state survives.
 *
 * Wire ack shapes match iOS exactly (see `LiquidToastsModule.swift`).
 */
class LiquidToastsModule : Module() {
    private var scope: CoroutineScope? = null
    private var manager: ToastManager? = null
    private var overlay: OverlayHost? = null
    private var overlayActivity: Activity? = null

    private val lifecycleObserver = object : DefaultLifecycleObserver {
        override fun onStart(owner: LifecycleOwner) {
            manager?.appWillEnterForeground()
        }

        override fun onStop(owner: LifecycleOwner) {
            manager?.appDidEnterBackground()
        }
    }

    override fun definition() = ModuleDefinition {
        Name("LiquidToasts")

        // Single event carrying the wire-ready payload; JS routes by `id`.
        Events("onToastEvent")

        OnCreate {
            val newScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
            scope = newScope
            val density = appContext.reactContext?.resources?.displayMetrics?.density ?: 1f
            val newManager = ToastManager(
                scope = newScope,
                decodeImage = { bytes -> ToastImageDecoder.decode(bytes, density) },
            )
            newManager.onEvent = { payload ->
                newScope.launch { sendEvent("onToastEvent", payload) }
            }
            newManager.onHaptic = { kind -> overlay?.performHaptic(kind) }
            manager = newManager

            ProcessLifecycleOwner.get().lifecycle.addObserver(lifecycleObserver)
            // Eager install so the first toast animates in.
            installOverlay()
        }

        OnDestroy {
            ProcessLifecycleOwner.get().lifecycle.removeObserver(lifecycleObserver)
            overlay?.teardown()
            overlay = null
            overlayActivity = null
            manager = null
            scope?.cancel()
            scope = null
        }

        // A JS reload gets a fresh activity attachment; rebuild the overlay
        // against it while the manager state survives.
        OnActivityEntersForeground {
            installOverlay()
        }

        /**
         * Flushes any state left over from a previous JS context. Native flushes
         * **unconditionally** on every handshake, which clears stale toasts after a
         * fast-refresh / reload (the old JS listener is gone, so those toasts must
         * be dropped silently).
         */
        AsyncFunction("handshake") { _: String ->
            requireManager().flushAll()
            installOverlay()
        }

        AsyncFunction("configure") { args: Map<String, Any?> ->
            val manager = requireManager()
            args.optInt("maxVisible")?.let { manager.maxVisible = maxOf(1, it) }
            args.optInt("maxQueue")?.let { manager.maxQueue = maxOf(1, it) }
            (args["dropPolicy"] as? String)?.let { manager.dropOldest = it != "dropNewest" }
            args.optMap("safeArea")?.let { safeArea ->
                manager.customSafeArea.value = ToastSafeArea(
                    top = maxOf(0.0, safeArea.optDouble("top") ?: 0.0).toFloat(),
                    left = maxOf(0.0, safeArea.optDouble("left") ?: 0.0).toFloat(),
                    bottom = maxOf(0.0, safeArea.optDouble("bottom") ?: 0.0).toFloat(),
                    right = maxOf(0.0, safeArea.optDouble("right") ?: 0.0).toFloat(),
                )
            }
            // defaultGlass is decoded-and-ignored (exact iOS parity).
        }

        AsyncFunction("show") { args: Map<String, Any?> ->
            val manager = requireManager()
            installOverlay()
            val id = args.optString("id")
                ?: throw InvalidArgumentsException("show: missing id/message")
            val model = ToastModel.fromWire(args, id)
                ?: throw InvalidArgumentsException("show: missing id/message")
            manager.present(model, args.byteArray("image"))
            mapOf(
                "id" to model.id,
                "accepted" to true,
                "capability" to mapOf(
                    "dynamicIslandOriginUsed" to false,
                    "glassMode" to GLASS_MODE,
                ),
            )
        }

        AsyncFunction("update") { args: Map<String, Any?> ->
            val manager = requireManager()
            val id = args.optString("id")
                ?: throw InvalidArgumentsException("update: missing id/message")
            val model = ToastModel.fromWire(args, id)
                ?: throw InvalidArgumentsException("update: missing id/message")
            val applied = manager.update(id, model, args.byteArray("image"))
            val res = mutableMapOf<String, Any?>("id" to id, "applied" to applied)
            if (!applied) res["reason"] = "unknown_id"
            res
        }

        AsyncFunction("dismiss") { id: String ->
            val ok = requireManager().dismiss(id, "manual")
            val res = mutableMapOf<String, Any?>("id" to id, "dismissed" to ok)
            if (!ok) res["reason"] = "unknown_id"
            res
        }

        AsyncFunction("dismissAll") { reason: String? ->
            mapOf("dismissedIds" to requireManager().dismissAll(reason ?: "dismissAll"))
        }

        AsyncFunction("finishAction") { id: String ->
            requireManager().finishAction(id)
        }

        /**
         * Simulates an action-button tap (drives the spinner + lifecycle). Used by
         * demos/tests that can't synthesize a real touch.
         */
        AsyncFunction("debugTriggerAction") { id: String ->
            requireManager().handleActionTap(id)
        }

        AsyncFunction("queryGeometry") {
            Geometry.snapshot(appContext.throwingActivity).toMutableMap().apply {
                this["glassMode"] = GLASS_MODE
            }
        }
    }

    /**
     * (Re)installs the overlay against the current activity. Tears down a host
     * bound to a stale activity first — the [ToastManager] survives, so
     * already-shown toasts skip their entrance via `ToastModel.hasEntered`.
     */
    private fun installOverlay() {
        val activity = appContext.activityProvider?.currentActivity ?: return
        val manager = manager ?: return
        if (overlay != null && overlayActivity === activity) {
            overlay?.bringToFront()
            return
        }
        overlay?.teardown()
        val host = OverlayHost(activity, manager)
        overlay = host
        overlayActivity = activity
        host.install()
    }

    private fun requireManager(): ToastManager =
        manager ?: throw CodedException("ERR_NOT_ATTACHED", "Module not initialized", null)

    private companion object {
        /**
         * Android renders an opaque surface (no Liquid Glass / no blur); nothing on
         * the JS side branches on this — it's an honest capability string.
         */
        const val GLASS_MODE = "opaque"
    }
}
