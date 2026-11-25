package kr.phonedash.app

import android.app.Activity
import android.content.Context
import android.util.Log
import com.google.android.play.core.review.ReviewManagerFactory
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Google Play's own rating card (In-App Review), shown at a quiet moment once [ReviewTiming] says so. Play decides
 * whether the card really appears and never tells the app what was answered. Runs on the main thread.
 */
class ReviewAsk(private val activity: Activity, private val asked: () -> Unit) {
    private val prefs = activity.getSharedPreferences("review", Context.MODE_PRIVATE)
    private var tried = false // once per start: a refusal is not retried with every touch

    /** Counts today as a day of use. The panel can stay open for weeks, so every quiet moment counts as well. */
    fun used() {
        val seen = load()
        val next = ReviewTiming.opened(seen, today())
        if (next != seen) save(next)
    }

    /** Nothing is open on the panel and the last touch was a moment ago; [calm] tells whether that still holds later. */
    fun quietMoment(calm: () -> Boolean) {
        used()
        if (tried || !calm() || !ReviewTiming.due(load(), today())) return
        tried = true
        val manager = ReviewManagerFactory.create(activity)
        manager.requestReviewFlow().addOnCompleteListener { request ->
            when {
                !request.isSuccessful -> Log.w(TAG, "review: ${request.exception?.message}")
                !calm() -> tried = false
                else -> {
                    save(ReviewTiming.asked(load(), today()))
                    asked()
                    manager.launchReviewFlow(activity, request.result)
                }
            }
        }
    }

    private fun today(): Long {
        val now = Calendar.getInstance()
        return TimeUnit.MILLISECONDS.toDays(now.timeInMillis + now.get(Calendar.ZONE_OFFSET) + now.get(Calendar.DST_OFFSET))
    }

    private fun load() = ReviewTiming.Seen(
        firstDay = prefs.getLong("firstDay", 0), lastDay = prefs.getLong("lastDay", 0), days = prefs.getInt("days", 0),
        askedDay = prefs.getLong("askedDay", 0), asks = prefs.getInt("asks", 0),
    )

    private fun save(seen: ReviewTiming.Seen) = prefs.edit()
        .putLong("firstDay", seen.firstDay).putLong("lastDay", seen.lastDay).putInt("days", seen.days)
        .putLong("askedDay", seen.askedDay).putInt("asks", seen.asks).apply()

    private companion object { const val TAG = "PhoneDashReview" }
}
