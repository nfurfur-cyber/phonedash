package kr.phonedash.app

import org.json.JSONObject
import java.security.MessageDigest

/** A computer that answered on this Wi-Fi. Nothing in it is proven yet: see [NearbyCode.number]. */
internal class NearbyPc(val name: String, val host: String, val port: Int, val fingerprint: String)

/**
 * The fixed parts of pairing on the same Wi-Fi without a QR code; the agent has the same in NearbyPairing.cs, with the
 * same test vectors. The phone commits to a random value before it learns the computer's, then both make a six-digit
 * number from the certificate and both values, and a person compares the two screens.
 */
internal object NearbyCode {
    const val PORT = 8776
    const val NONCE_BYTES = 16
    private const val QUESTION_BYTES = 400
    private const val MAX_ANSWER_BYTES = 400
    private val FINGERPRINT = Regex("^[0-9a-f]{64}$")
    private val HEX = Regex("^([0-9a-f]{2})+$")

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

    /** Lower-case hex of exactly [length] bytes, or null. */
    fun bytes(hex: String, length: Int): ByteArray? =
        if (hex.length != length * 2 || !HEX.matches(hex)) null
        else ByteArray(length) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    fun commitment(phoneNonce: ByteArray): String = hex(hash("phonedash-nearby-commit-1", phoneNonce))

    /** The number on both screens, "123 456". */
    fun number(fingerprint: ByteArray, pcNonce: ByteArray, phoneNonce: ByteArray): String {
        val digest = hash("phonedash-nearby-number-1", fingerprint, pcNonce, phoneNonce)
        val value = java.math.BigInteger(1, digest.copyOf(8)).mod(java.math.BigInteger.valueOf(1_000_000)).toInt()
        val digits = value.toString().padStart(6, '0') // not %d: it would use the phone's own digits in some languages
        return digits.take(3) + " " + digits.drop(3)
    }

    private fun hash(label: String, vararg parts: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").run {
        update(label.toByteArray(Charsets.US_ASCII))
        update(0)
        parts.forEach { update(it) }
        digest()
    }

    /** The question sent to the network; padded so that a computer's answer is never larger than it. */
    fun question(nonce: ByteArray): ByteArray = "PHONEDASH? 1 ${hex(nonce)}".padEnd(QUESTION_BYTES).toByteArray(Charsets.US_ASCII)

    /** A computer's answer to the question with [nonce], sent from [host]; null for anything else. */
    fun answer(data: ByteArray, length: Int, host: String, nonce: ByteArray): NearbyPc? {
        if (length !in 1..MAX_ANSWER_BYTES || !AgentLink.PairLink.isLocalAddress(host)) return null
        val j = try { JSONObject(String(data, 0, length, Charsets.UTF_8)) } catch (_: Exception) { return null }
        if (j.optInt("v") != 1 || j.optString("nonce") != hex(nonce)) return null
        val fingerprint = j.optString("fp").lowercase().takeIf { FINGERPRINT.matches(it) } ?: return null
        val port = j.optInt("port").takeIf { it in 1..65535 } ?: return null
        val name = j.optString("pc").filter { it >= ' ' }.trim().take(64).ifBlank { return null }
        return NearbyPc(name, host, port, fingerprint)
    }
}
