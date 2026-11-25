package kr.phonedash.app

/**
 * When the app may ask for a rating: after a week with at least [MIN_DAYS] days of use, then at most every
 * [PAUSE_DAYS] days and [MAX_ASKS] times in all. Days are counted from 1970 (local time). Everyone is asked alike:
 * Google Play does not allow picking out the happy users or asking how they like the app first.
 */
object ReviewTiming {
    data class Seen(val firstDay: Long = 0, val lastDay: Long = 0, val days: Int = 0, val askedDay: Long = 0, val asks: Int = 0)

    const val MIN_AGE_DAYS = 7L
    const val MIN_DAYS = 5
    const val PAUSE_DAYS = 120L
    const val MAX_ASKS = 3

    fun opened(seen: Seen, today: Long): Seen = when {
        seen.days == 0 -> seen.copy(firstDay = today, lastDay = today, days = 1)
        today > seen.lastDay -> seen.copy(lastDay = today, days = seen.days + 1)
        else -> seen // the same day, or a clock that was set back
    }

    fun due(seen: Seen, today: Long): Boolean =
        seen.days >= MIN_DAYS && today - seen.firstDay >= MIN_AGE_DAYS && seen.asks < MAX_ASKS &&
            (seen.asks == 0 || today - seen.askedDay >= PAUSE_DAYS)

    fun asked(seen: Seen, today: Long): Seen = seen.copy(askedDay = today, asks = seen.asks + 1)
}
