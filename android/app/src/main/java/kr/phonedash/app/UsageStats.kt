package kr.phonedash.app

import android.content.Context
import android.os.Bundle
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.FirebaseAnalytics.ConsentStatus
import com.google.firebase.analytics.FirebaseAnalytics.ConsentType
import org.json.JSONObject

/**
 * Usage statistics (Google Analytics for Firebase), off until the user agrees in the panel and off again whenever they
 * say so. The manifest keeps collection off, so nothing is sent before that; the advertising ID is never read (its
 * permission is removed) and ad features stay denied. Only [UsageEvents] can be sent besides what Analytics records by
 * itself. A build without google-services.json has no Firebase project: [available] is false and nothing is offered.
 */
class UsageStats(context: Context) {
    private val prefs = context.getSharedPreferences("usage", Context.MODE_PRIVATE)
    private val analytics: FirebaseAnalytics? =
        if (FirebaseApp.getApps(context).isEmpty()) null else FirebaseAnalytics.getInstance(context)
    @Volatile private var choice = UsageEvents.parse(prefs.getString(KEY_CHOICE, null))

    init { apply() }

    val available: Boolean get() = analytics != null

    /** What the panel needs to know: {"available":bool,"choice":"unset|on|off"}. */
    fun json(): String = JSONObject().put("available", available).put("choice", choice.name.lowercase()).toString()

    /** At once and before anything else is logged (the bridge may call from any thread). */
    @Synchronized
    fun choose(on: Boolean) {
        choice = if (on) UsageEvents.Choice.ON else UsageEvents.Choice.OFF
        prefs.edit().putString(KEY_CHOICE, choice.name).apply()
        apply()
        if (!on) analytics?.resetAnalyticsData() // a new statistics ID, and what had not been sent yet is dropped
    }

    /** Sends an event the user agreed to; anything not in [UsageEvents] is dropped. */
    @Synchronized
    fun log(name: String, json: String) {
        if (choice != UsageEvents.Choice.ON) return
        val params = UsageEvents.clean(name, json) ?: return
        val bundle = Bundle()
        params.forEach { (key, value) -> if (value is Long) bundle.putLong(key, value) else bundle.putString(key, value.toString()) }
        analytics?.logEvent(name, bundle)
    }

    private fun apply() {
        val on = choice == UsageEvents.Choice.ON
        analytics?.setConsent(
            mapOf(
                ConsentType.ANALYTICS_STORAGE to if (on) ConsentStatus.GRANTED else ConsentStatus.DENIED,
                ConsentType.AD_STORAGE to ConsentStatus.DENIED,
                ConsentType.AD_USER_DATA to ConsentStatus.DENIED,
                ConsentType.AD_PERSONALIZATION to ConsentStatus.DENIED,
            ),
        )
        analytics?.setAnalyticsCollectionEnabled(on)
    }

    private companion object { const val KEY_CHOICE = "choice" }
}
