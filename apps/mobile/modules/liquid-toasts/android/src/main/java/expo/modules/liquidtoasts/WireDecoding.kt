package expo.modules.liquidtoasts

import android.util.Base64

/**
 * Decoding helpers for the JS payloads the Expo bridge delivers as
 * `Map<String, Any?>`. Every JS number crosses as `Double` (and may arrive as
 * `Int`/`Long` from other paths), so plain casts on the primitive types are
 * unreliable — always go through these. The Android analog of
 * `WireDecoding.swift`'s NSNumber-aware accessors.
 */
internal fun Map<String, Any?>.optString(key: String): String? = this[key] as? String

/** Reads an int, accepting any numeric representation the bridge may deliver. */
internal fun Map<String, Any?>.optInt(key: String): Int? = when (val v = this[key]) {
    is Int -> v
    is Long -> v.toInt()
    is Number -> v.toInt()
    else -> null
}

/** Reads a double, accepting any numeric representation (`Int`/`Long`/`Double`/`Float`). */
internal fun Map<String, Any?>.optDouble(key: String): Double? = when (val v = this[key]) {
    is Double -> v
    is Float -> v.toDouble()
    is Int -> v.toDouble()
    is Long -> v.toDouble()
    is Number -> v.toDouble()
    else -> null
}

internal fun Map<String, Any?>.optBool(key: String, default: Boolean): Boolean =
    when (val v = this[key]) {
        is Boolean -> v
        else -> default
    }

@Suppress("UNCHECKED_CAST")
internal fun Map<String, Any?>.optMap(key: String): Map<String, Any?>? =
    this[key] as? Map<String, Any?>

/**
 * Image bytes. JS has no byte-array type over the bridge, so the leading image
 * crosses as a base64 string and is decoded here (the bitmap decode itself still
 * happens off-main — see [ToastImageDecoder]). Undecodable base64 yields null,
 * which collapses the reserved avatar slot rather than failing the show.
 */
internal fun Map<String, Any?>.byteArray(key: String): ByteArray? {
    val encoded = this[key] as? String ?: return null
    if (encoded.isEmpty()) return null
    return try {
        Base64.decode(encoded, Base64.DEFAULT)
    } catch (_: IllegalArgumentException) {
        null
    }
}

/**
 * Decodes a wire enum by its wire string, falling back to [default] when the key
 * is absent or holds an unknown value. [values] is the enum's entries (pass
 * `EnumType.entries`); each entry's wire name comes from [wireName].
 */
internal fun <E> Map<String, Any?>.enumByWireName(
    key: String,
    values: List<E>,
    wireName: (E) -> String,
    default: E,
): E {
    val raw = this[key] as? String ?: return default
    return values.firstOrNull { wireName(it) == raw } ?: default
}
