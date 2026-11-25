package kr.phonedash.app

import org.json.JSONArray
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.URL
import java.security.SecureRandom
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLSocketFactory

/**
 * The first-start screen's Wi-Fi way: finds computers on this Wi-Fi whose pairing window is open, and pairs with the
 * one the user taps once the same number was confirmed on both screens ([NearbyCode]). The screen gets every change as
 * one JSON snapshot: {"state": "searching|asking|compare|waiting|failed", "wifi": bool, "pcs": [{"id","name"}],
 * "pc": name, "code": "123 456", "attempt": which request the code belongs to}.
 */
internal class NearbyPairing(private val link: AgentLink, private val show: (String) -> Unit, private val paired: (String) -> Unit) {

    private class Found(val pc: NearbyPc, val seenAt: Long)

    /** One request to a computer; [number] tells a late tap for an older one apart. */
    private class Attempt(val pc: NearbyPc, val number: Int) {
        @Volatile var cancelled = false
        @Volatile var confirmed = false
        @Volatile var id: String? = null
    }

    private val lock = Any()
    private var found: Map<String, Found> = emptyMap()
    private var onWifi = true
    private var search: Thread? = null
    private var attempt: Attempt? = null
    private var attempts = 0
    private var state = "searching"
    private var code = ""
    private var lastShown = ""

    fun start() = synchronized(lock) {
        if (search?.isAlive == true) return
        lastShown = ""
        search = Thread({ searchLoop() }, "nearby-search").apply { isDaemon = true; start() }
    }

    fun stop() {
        synchronized(lock) {
            search?.interrupt()
            search = null
            found = emptyMap()
        }
        cancel()
    }

    /** The user tapped the computer with certificate [id]. */
    fun pair(id: String) {
        val next = synchronized(lock) {
            if (attempt != null) return
            val pc = found[id]?.pc ?: return
            state = "asking"
            code = ""
            Attempt(pc, ++attempts).also { attempt = it }
        }
        publish()
        Thread({ run(next) }, "nearby-pair").apply { isDaemon = true; start() }
    }

    /** The user says both screens show the number of request [number]. */
    fun confirm(number: Int) {
        synchronized(lock) {
            val current = attempt ?: return
            if (state != "compare" || current.number != number) return
            current.confirmed = true
            state = "waiting"
        }
        publish()
    }

    /** The numbers differ, or the user changed their mind. */
    fun cancel() {
        val old = synchronized(lock) {
            state = "searching"
            code = ""
            attempt.also { attempt = null }
        }
        publish()
        old?.let { a ->
            a.cancelled = true
            Thread({ withdraw(a) }, "nearby-withdraw").apply { isDaemon = true; start() }
        }
    }

    // ---- finding computers

    private fun searchLoop() {
        val me = Thread.currentThread()
        while (!me.isInterrupted && synchronized(lock) { search === me }) {
            val links = link.lanLinks().mapNotNull { l -> link.networkOwning(l)?.let { l to it } }
            val answers = links.flatMap { (l, network) -> ask(l, network) }
            val now = System.currentTimeMillis()
            synchronized(lock) {
                if (search !== me) return
                onWifi = links.isNotEmpty()
                val fresh = found.filterValues { now - it.seenAt < FORGET_MS } + answers.associate { it.fingerprint to Found(it, now) }
                found = fresh.entries.sortedBy { it.value.pc.name }.take(MAX_PCS).associate { it.toPair() }
            }
            publish()
            try { Thread.sleep(PAUSE_MS) } catch (_: InterruptedException) { return }
        }
    }

    private fun ask(from: LanLink, network: android.net.Network): List<NearbyPc> {
        val nonce = random(8)
        val question = NearbyCode.question(nonce)
        val answers = ArrayList<NearbyPc>()
        try {
            DatagramSocket().use { socket ->
                network.bindSocket(socket)
                socket.broadcast = true
                for (target in listOfNotNull(InetAddress.getByName("255.255.255.255"), from.broadcast)) {
                    try { socket.send(DatagramPacket(question, question.size, target, NearbyCode.PORT)) } catch (_: java.io.IOException) { /* the other address still tries */ }
                }
                val end = System.currentTimeMillis() + LISTEN_MS
                val buffer = ByteArray(1024)
                while (answers.size < MAX_PCS) {
                    val left = end - System.currentTimeMillis()
                    if (left <= 0) break
                    socket.soTimeout = left.toInt().coerceAtLeast(1)
                    val packet = DatagramPacket(buffer, buffer.size)
                    socket.receive(packet)
                    val host = packet.address.hostAddress ?: continue
                    NearbyCode.answer(packet.data, packet.length, host, nonce)?.let { answers.add(it) }
                }
            }
        } catch (_: SocketTimeoutException) {
            // the usual end: nobody else answered
        } catch (_: Exception) {
            // Wi-Fi went away: the next round looks again
        }
        return answers.distinctBy { it.fingerprint }
    }

    // ---- pairing with one of them

    private fun run(a: Attempt) {
        try {
            val factory = link.getPinnedFactory(a.pc.fingerprint)
            val phoneNonce = random(NearbyCode.NONCE_BYTES)
            val begun = post(a.pc, factory, "begin", JSONObject().put("commit", NearbyCode.commitment(phoneNonce)))
            if (begun.first != 200) return fail(a)
            val j = JSONObject(begun.second)
            val id = j.getString("id")
            a.id = id
            val pcNonce = NearbyCode.bytes(j.getString("nonce"), NearbyCode.NONCE_BYTES) ?: return fail(a)
            val fingerprint = NearbyCode.bytes(a.pc.fingerprint, 32) ?: return fail(a)
            if (post(a.pc, factory, "reveal", JSONObject().put("id", id).put("nonce", NearbyCode.hex(phoneNonce))).first != 200) return fail(a)
            synchronized(lock) {
                if (attempt !== a) return
                state = "compare"
                code = NearbyCode.number(fingerprint, pcNonce, phoneNonce)
            }
            publish()
            val data = waitForConnect(a, factory, id) ?: return fail(a)
            if (!waitForConfirm(a)) return fail(a)
            // under the lock: a cancel that came first keeps the computer out, one that comes later is too late
            val stored = synchronized(lock) {
                if (attempt !== a || a.cancelled) return
                link.storePairing(a.pc, JSONObject(data)).also { if (it) attempt = null }
            }
            if (stored) paired(a.pc.name) else fail(a)
        } catch (_: Exception) {
            fail(a)
        }
    }

    /** Asks every second whether the number was picked on the computer; its answer carries the Wi-Fi key. */
    private fun waitForConnect(a: Attempt, factory: SSLSocketFactory, id: String): String? {
        val end = System.currentTimeMillis() + WAIT_MS
        var errors = 0
        while (!a.cancelled && System.currentTimeMillis() < end) {
            val reply = try { post(a.pc, factory, "poll", JSONObject().put("id", id)) } catch (e: java.io.IOException) {
                if (++errors > 3) throw e
                202 to ""
            }
            when (reply.first) {
                200 -> return reply.second
                202 -> Thread.sleep(1000)
                else -> return null
            }
        }
        return null
    }

    /** The computer's side is done: without the user's yes on this screen nothing is kept. */
    private fun waitForConfirm(a: Attempt): Boolean {
        val end = System.currentTimeMillis() + WAIT_MS
        while (!a.cancelled && !a.confirmed && System.currentTimeMillis() < end) Thread.sleep(200)
        return a.confirmed && !a.cancelled
    }

    private fun fail(a: Attempt) {
        synchronized(lock) {
            if (attempt !== a) return // cancelled by the user
            attempt = null
            state = "failed"
            code = ""
        }
        publish(a.pc.name)
        withdraw(a)
    }

    private fun withdraw(a: Attempt) {
        val id = a.id ?: return
        try { post(a.pc, link.getPinnedFactory(a.pc.fingerprint), "withdraw", JSONObject().put("id", id)) } catch (_: Exception) { /* the request ends by itself */ }
    }

    private fun post(pc: NearbyPc, factory: SSLSocketFactory, step: String, body: JSONObject): Pair<Int, String> {
        val c = URL("https://${pc.host}:${pc.port}/api/pair/nearby/$step").openConnection() as HttpsURLConnection
        try {
            c.instanceFollowRedirects = false
            c.sslSocketFactory = factory
            c.hostnameVerifier = HostnameVerifier { _, _ -> true } // identity is the pinned certificate
            c.connectTimeout = 3000
            c.readTimeout = 5000
            c.requestMethod = "POST"
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.setRequestProperty("X-PhoneBox-Model", link.deviceModel)
            c.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = c.responseCode
            val text = if (status == 200) c.inputStream.use { readLimited(it) } else ""
            return status to text
        } finally {
            c.disconnect()
        }
    }

    private fun readLimited(input: java.io.InputStream): String {
        val out = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(4096)
        while (true) {
            val n = input.read(buffer)
            if (n < 0) return out.toString("UTF-8")
            out.write(buffer, 0, n)
            if (out.size() > MAX_REPLY_BYTES) throw java.io.IOException("reply too large")
        }
    }

    private fun publish(pcName: String? = null) {
        val json = synchronized(lock) {
            val snapshot = JSONObject().put("state", state).put("wifi", onWifi).put("code", code)
                .put("attempt", attempt?.number ?: 0)
                .put("pc", pcName ?: attempt?.pc?.name ?: "")
                .put("pcs", JSONArray().apply { found.values.forEach { put(JSONObject().put("id", it.pc.fingerprint).put("name", it.pc.name)) } })
                .toString()
            if (snapshot == lastShown) return
            lastShown = snapshot
            snapshot
        }
        show(json)
    }

    private fun random(size: Int) = ByteArray(size).also { SecureRandom().nextBytes(it) }

    companion object {
        private const val LISTEN_MS = 1200L
        private const val PAUSE_MS = 1800L
        private const val FORGET_MS = 10_000L
        private const val WAIT_MS = 2 * 60_000L
        private const val MAX_PCS = 6
        private const val MAX_REPLY_BYTES = 64 * 1024
    }
}
