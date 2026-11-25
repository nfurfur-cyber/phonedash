package kr.phonedash.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UsageEventsTest {
    private val nothing = emptyMap<String, Any>()

    @Test
    fun knownEventsKeepOnlyTheirOwnParameters() {
        assertEquals(mapOf("from" to "page"), UsageEvents.clean("pro_open", """{"from":"page","title":"secret"}"""))
        assertEquals(mapOf("widget" to "app-console"), UsageEvents.clean("widget_day", """{"widget":"app-console"}"""))
        assertEquals(nothing, UsageEvents.clean("overview_open", "{}"))
        assertEquals(nothing, UsageEvents.clean("overview_open", ""))
    }

    @Test
    fun unknownEventsAreDropped() {
        assertNull(UsageEvents.clean("typed_text", """{"text":"hello"}"""))
        assertNull(UsageEvents.clean("", "{}"))
    }

    @Test
    fun freeTextNeverPasses() {
        // page titles, addresses, names: anything with spaces or odd characters, or too long
        for (bad in listOf("My page", "a@b.c", "https://x.y", "한글", "", "x".repeat(41)))
            assertEquals(bad, nothing, UsageEvents.clean("widget_day", """{"widget":"$bad"}"""))
    }

    @Test
    fun choicesMustBeOnTheList() {
        assertEquals(nothing, UsageEvents.clean("pro_open", """{"from":"elsewhere"}"""))
        assertEquals(mapOf("link" to "wifi"), UsageEvents.clean("panel_day", """{"link":"wifi","theme":"my-own"}"""))
    }

    @Test
    fun countsAreWholeNumbersInRange() {
        assertEquals(
            mapOf("link" to "usb", "pages" to 7L, "buttons" to 12L, "widgets" to 40L, "theme" to "amoled", "lang" to "ko", "pro" to "free"),
            UsageEvents.clean("panel_day", """{"link":"usb","pages":7,"buttons":12,"widgets":40,"theme":"amoled","lang":"ko","pro":"free"}"""),
        )
        assertEquals(nothing, UsageEvents.clean("panel_day", """{"pages":-1,"buttons":1000000,"widgets":"many"}"""))
    }

    @Test
    fun brokenJsonIsDropped() {
        assertNull(UsageEvents.clean("pro_open", "{from"))
        assertNull(UsageEvents.clean("pro_open", "x".repeat(2000)))
    }

    @Test
    fun namesFitGoogleAnalytics() {
        val name = Regex("[a-z][a-z_]{0,39}")
        for ((event, params) in UsageEvents.EVENTS) {
            assertTrue(event, name.matches(event))
            assertFalse(event, listOf("firebase_", "google_", "ga_").any { event.startsWith(it) })
            params.keys.forEach { assertTrue(it, name.matches(it)) }
        }
    }

    @Test
    fun onlyAClearYesOrNoCountsAsAnAnswer() {
        assertEquals(UsageEvents.Choice.UNSET, UsageEvents.parse(null))
        assertEquals(UsageEvents.Choice.UNSET, UsageEvents.parse("garbage"))
        assertEquals(UsageEvents.Choice.ON, UsageEvents.parse("ON"))
        assertEquals(UsageEvents.Choice.OFF, UsageEvents.parse("OFF"))
    }
}
