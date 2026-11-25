package kr.phonedash.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReviewTimingTest {
    private fun used(vararg days: Long) = days.fold(ReviewTiming.Seen()) { seen, day -> ReviewTiming.opened(seen, day) }

    @Test
    fun aDayCountsOnce() {
        assertEquals(ReviewTiming.Seen(firstDay = 100, lastDay = 101, days = 2), used(100, 100, 101, 101))
    }

    @Test
    fun aClockSetBackDoesNotAddDays() {
        assertEquals(2, used(100, 101, 50).days)
    }

    @Test
    fun askedOnlyAfterAWeekWithFiveDaysOfUse() {
        assertFalse(ReviewTiming.due(ReviewTiming.Seen(), 100))
        assertFalse(ReviewTiming.due(used(100, 101, 102, 103, 104), 104)) // five days of use, but not a week yet
        assertFalse(ReviewTiming.due(used(100, 107), 107)) // a week, but hardly used
        assertTrue(ReviewTiming.due(used(100, 101, 102, 103, 107), 107))
    }

    @Test
    fun askedAgainAfterFourMonthsAndThreeTimesAtMost() {
        val first = ReviewTiming.asked(used(100, 101, 102, 103, 107), 107)
        assertFalse(ReviewTiming.due(first, 108))
        assertFalse(ReviewTiming.due(first, 226))
        assertTrue(ReviewTiming.due(first, 227))
        val third = ReviewTiming.asked(ReviewTiming.asked(first, 227), 347)
        assertFalse(ReviewTiming.due(third, 2000))
    }
}
