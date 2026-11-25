package kr.phonedash.app

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Locale

class NearbyTest {
    private val phoneNonce = ByteArray(16) { (it + 1).toByte() }
    private val pcNonce = ByteArray(16) { (it + 16).toByte() }
    private val fp = ByteArray(32) { 0xAA.toByte() }
    private val fpHex = "a".repeat(64)
    private val nonce = ByteArray(8) { it.toByte() }

    // NearbyPairingTests.cs has the same vectors: both sides must agree to the digit
    @Test
    fun theNumberAndCommitmentAreTheOnesTheComputerComputes() {
        assertEquals("571 156", NearbyCode.number(fp, pcNonce, phoneNonce))
        assertEquals("fdf392addb3e9a7053b279f093f93f3151eaf5f22179f6511bc14f142d93c3ab", NearbyCode.commitment(phoneNonce))
    }

    @Test
    fun theNumberIsTheSameInEveryLanguage() {
        val before = Locale.getDefault()
        try {
            Locale.setDefault(Locale.forLanguageTag("ar-EG-u-nu-arab"))
            assertEquals("571 156", NearbyCode.number(fp, pcNonce, phoneNonce))
            assertEquals("aaaa", NearbyCode.hex(byteArrayOf(0xAA.toByte(), 0xAA.toByte())))
        } finally {
            Locale.setDefault(before)
        }
    }

    @Test
    fun anotherCertificateOrValueShowsAnotherNumber() {
        assertNotEquals("571 156", NearbyCode.number(ByteArray(32), pcNonce, phoneNonce))
        assertNotEquals("571 156", NearbyCode.number(fp, phoneNonce, phoneNonce))
        assertNotEquals("571 156", NearbyCode.number(fp, pcNonce, pcNonce))
    }

    @Test
    fun hexIsReadExactly() {
        assertArrayEquals(byteArrayOf(0, 0xFF.toByte()), NearbyCode.bytes("00ff", 2))
        assertNull(NearbyCode.bytes("00f", 2))
        assertNull(NearbyCode.bytes("00FF", 2))
        assertNull(NearbyCode.bytes("00ff", 3))
        assertNull(NearbyCode.bytes("zzzz", 2))
    }

    @Test
    fun theQuestionIsPaddedSoAnAnswerIsNeverLarger() {
        val q = NearbyCode.question(nonce)
        assertEquals(400, q.size)
        assertEquals("PHONEDASH? 1 0001020304050607", String(q, Charsets.US_ASCII).trimEnd())
    }

    private fun answer(change: (JSONObject) -> Unit = {}, host: String = "192.168.0.5"): NearbyPc? {
        val j = JSONObject().put("v", 1).put("nonce", NearbyCode.hex(nonce)).put("pc", "DESK").put("port", 8776).put("fp", fpHex)
        change(j)
        val bytes = j.toString().toByteArray()
        return NearbyCode.answer(bytes, bytes.size, host, nonce)
    }

    @Test
    fun anAnswerNamesTheComputer() {
        val pc = answer()!!
        assertEquals("DESK", pc.name)
        assertEquals("192.168.0.5", pc.host) // where the packet came from, not something the packet says
        assertEquals(8776, pc.port)
        assertEquals(fpHex, pc.fingerprint)
    }

    @Test
    fun anythingElseIsNotAnAnswer() {
        assertNull(answer({ it.put("v", 2) }))
        assertNull(answer({ it.put("nonce", "ffffffffffffffff") })) // an answer to somebody else's question
        assertNull(answer({ it.put("fp", "abc") }))
        assertNull(answer({ it.put("port", 0) }))
        assertNull(answer({ it.put("port", 70000) }))
        assertNull(answer({ it.put("pc", "\u0000\n") }))
        assertNull(answer({ it.put("pc", "x".repeat(500)) })) // larger than any answer may be
        assertNull(answer(host = "8.8.8.8"))
        assertNull(answer(host = "fe80::1"))
        assertNull(NearbyCode.answer("{".toByteArray(), 1, "192.168.0.5", nonce))
        assertNull(NearbyCode.answer(ByteArray(0), 0, "192.168.0.5", nonce))
    }

    @Test
    fun aNameCannotBreakTheScreen() {
        assertEquals("DE SK", answer({ it.put("pc", "\u0007DE SK\n") })!!.name)
        assertEquals(64, answer({ it.put("pc", "x".repeat(80)) })!!.name.length)
    }
}
