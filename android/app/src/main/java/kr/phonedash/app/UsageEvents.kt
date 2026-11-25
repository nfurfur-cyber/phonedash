package kr.phonedash.app

import org.json.JSONException
import org.json.JSONObject

/**
 * What PhoneDash may report about its use, once the user has agreed ([UsageStats]). It is a list of what is allowed,
 * not of what is forbidden: an event or parameter that is not here never leaves the phone, and a value is one of a
 * few fixed words, a short code (a widget's type, never a title the user typed) or a count. Kept apart from Firebase
 * so it can be tested on the JVM. PRIVACY.md describes every entry.
 */
object UsageEvents {
    enum class Choice { UNSET, ON, OFF }

    sealed interface Kind {
        /** One of these words. */
        data class OneOf(val words: Set<String>) : Kind

        /** A code of the app's own (widget type, language): letters, digits, "-" and "_" only, so no free text. */
        data object Code : Kind

        /** A whole number from 0 to 9999. */
        data object Count : Kind
    }

    private fun oneOf(vararg words: String) = Kind.OneOf(words.toSet())
    private val LINK = oneOf("usb", "wifi", "none")

    val EVENTS: Map<String, Map<String, Kind>> = mapOf(
        // once a day while the panel is connected: how it is set up
        "panel_day" to mapOf(
            "link" to LINK, "pages" to Kind.Count, "buttons" to Kind.Count, "widgets" to Kind.Count,
            "theme" to oneOf("default", "amoled", "midnight", "warm", "graphite"), "lang" to Kind.Code, "pro" to oneOf("free", "pending", "pro"),
        ),
        // once a day per kind of widget on the open pages
        "widget_day" to mapOf("widget" to Kind.Code),
        "overview_open" to emptyMap(),
        // Pro: from seeing a lock to buying (the purchase itself is reported by Google Analytics)
        "locked_seen" to emptyMap(),
        "pro_open" to mapOf("from" to oneOf("page", "button", "overview")),
        "pro_buy" to mapOf("problem" to oneOf("none", "play", "network", "product", "error")),
        "review_ask" to emptyMap(),
    )

    private val code = Regex("[A-Za-z0-9_-]{1,40}")
    private const val MAX_JSON = 1000
    private const val MAX_COUNT = 9999L

    fun parse(saved: String?): Choice = Choice.entries.firstOrNull { it.name == saved } ?: Choice.UNSET

    /** The parameters of [name] that may be sent, or null when the event is unknown or [json] is broken. */
    fun clean(name: String, json: String): Map<String, Any>? {
        val allowed = EVENTS[name] ?: return null
        if (json.length > MAX_JSON) return null
        val given = try { if (json.isBlank()) JSONObject() else JSONObject(json) } catch (e: JSONException) { return null }
        return allowed.mapNotNull { (param, kind) -> valueOf(kind, given.opt(param))?.let { param to it } }.toMap()
    }

    private fun valueOf(kind: Kind, value: Any?): Any? = when (kind) {
        is Kind.OneOf -> (value as? String)?.takeIf { it in kind.words }
        Kind.Code -> (value as? String)?.takeIf { code.matches(it) }
        Kind.Count -> (value as? Number)?.toLong()?.takeIf { it in 0..MAX_COUNT }
    }
}
