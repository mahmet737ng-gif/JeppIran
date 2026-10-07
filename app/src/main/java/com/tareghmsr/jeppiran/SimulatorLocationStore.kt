package com.tareghmsr.jeppiran

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.SocketException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.json.JSONObject
import kotlin.concurrent.thread

data class SimulatorPosition(
    val latitude: Double,
    val longitude: Double,
    val altitudeMeters: Double?,
    val headingDegrees: Double?,
    val groundSpeedMps: Double? = null,
    val pitchDegrees: Double? = null,
    val rollDegrees: Double? = null,
    val timestampMillis: Long = System.currentTimeMillis()
)

object SimulatorLocationStore {
    const val TYPE_XPLANE = "X-Plane 11 / 12"
    const val TYPE_MSFS = "Microsoft Flight Simulator 2020 / 2024"
    const val TYPE_P3D = "Prepar3D v4 / v5 / v6"
    const val MODE_XPLANE_BROADCAST = "X-Plane Auto / Mapping Broadcast"
    const val MODE_XPLANE_RREF = "X-Plane Direct IP / RREF"
    const val MODE_BRIDGE = "Desktop Bridge"
    const val DEFAULT_XPLANE_MAPPING_PORT = 49002
    const val DEFAULT_XPLANE_RREF_PORT = 49000

    private const val PREFS = "simulator_connection"
    private const val PREF_TYPE = "type"
    private const val PREF_HOST = "host"
    private const val PREF_PORT = "port"
    private const val PREF_XP_MODE = "xplane_mode"
    private const val PREF_XP_MAP_PORT = "xplane_mapping_port"
    private const val PREF_XP_RREF_PORT = "xplane_rref_port"
    private const val INITIAL_TIMEOUT = 8000L
    private const val LIVE_TIMEOUT = 6000L
    private const val ATTITUDE_FRESH = 2500L

    @Volatile private var position: SimulatorPosition? = null
    @Volatile private var connected = false
    @Volatile private var connecting = false
    @Volatile private var status = "Disconnected"
    @Volatile private var mode = ""
    @Volatile private var source = ""
    @Volatile private var lastPositionMs = 0L
    @Volatile private var lastPacketMs = 0L
    @Volatile private var running = false
    @Volatile private var session = 0L

    private var socket: DatagramSocket? = null
    private var worker: Thread? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var appContext: Context? = null

    fun isConnected() = connected
    fun isConnecting() = connecting
    fun getPosition() = position
    fun getStatus() = status
    fun getConnectionMode() = mode
    fun getSourceAddress() = source
    fun getLastPacketAgeMillis(): Long? = lastPacketMs.takeIf { it > 0 }?.let { System.currentTimeMillis() - it }

    fun savedType(c: Context) = prefs(c).getString(PREF_TYPE, TYPE_XPLANE) ?: TYPE_XPLANE
    fun savedHost(c: Context) = prefs(c).getString(PREF_HOST, "") ?: ""
    fun savedPort(c: Context) = prefs(c).getInt(PREF_PORT, DEFAULT_XPLANE_RREF_PORT)
    fun savedXPlaneMode(c: Context) = prefs(c).getString(PREF_XP_MODE, MODE_XPLANE_BROADCAST) ?: MODE_XPLANE_BROADCAST
    fun savedXPlaneMappingPort(c: Context) = prefs(c).getInt(PREF_XP_MAP_PORT, DEFAULT_XPLANE_MAPPING_PORT)
    fun savedXPlaneRrefPort(c: Context) = prefs(c).getInt(PREF_XP_RREF_PORT, DEFAULT_XPLANE_RREF_PORT)

    fun saveSettings(c: Context, type: String, host: String, port: Int) {
        prefs(c).edit().putString(PREF_TYPE, type).putString(PREF_HOST, host).putInt(PREF_PORT, port).apply()
    }

    fun connectXPlaneBroadcast(c: Context, port: Int = savedXPlaneMappingPort(c)) {
        prefs(c).edit().putString(PREF_TYPE, TYPE_XPLANE).putString(PREF_XP_MODE, MODE_XPLANE_BROADCAST)
            .putInt(PREF_XP_MAP_PORT, port).apply()
        begin(c, MODE_XPLANE_BROADCAST) { id -> runBroadcast(port, id) }
    }

    fun connectXPlaneDirect(c: Context, host: String, port: Int) {
        prefs(c).edit().putString(PREF_TYPE, TYPE_XPLANE).putString(PREF_XP_MODE, MODE_XPLANE_RREF)
            .putString(PREF_HOST, host).putInt(PREF_XP_RREF_PORT, port).apply()
        begin(c, MODE_XPLANE_RREF) { id -> runRref(host, port, id) }
    }

    @Synchronized
    fun connect(c: Context, type: String, host: String, port: Int) {
        when (type) {
            TYPE_XPLANE -> connectXPlaneDirect(c, host, port)
            TYPE_MSFS -> { saveSettings(c, type, "", port); begin(c, MODE_BRIDGE) { runBridge(port, "MSFS", it) } }
            TYPE_P3D -> { saveSettings(c, type, "", port); begin(c, MODE_BRIDGE) { runBridge(port, "Prepar3D", it) } }
            else -> { connected = false; connecting = false; status = "Connection failed: unsupported simulator" }
        }
    }

    @Synchronized
    fun disconnect() = stop(true)

    @Synchronized
    private fun begin(c: Context, newMode: String, body: (Long) -> Unit) {
        stop(false)
        val id = ++session
        appContext = c.applicationContext
        mode = newMode
        source = ""
        position = null
        connected = false
        connecting = true
        lastPositionMs = 0
        lastPacketMs = 0
        running = true
        status = if (newMode == MODE_XPLANE_BROADCAST) "Listening for X-Plane mapping broadcast..." else "Testing simulator connection..."
        worker = thread(name = "JeppIran-Simulator") {
            try { body(id) }
            catch (t: Throwable) { if (active(id)) fail(t.message ?: "network error", id) }
            finally {
                if (session == id) {
                    try { socket?.close() } catch (_: Throwable) {}
                    socket = null
                    releaseMulticastLock()
                    worker = null
                }
            }
        }
    }

    private fun stop(user: Boolean) {
        session++
        running = false
        try { socket?.close() } catch (_: Throwable) {}
        socket = null
        worker?.interrupt()
        worker = null
        releaseMulticastLock()
        connected = false
        connecting = false
        position = null
        source = ""
        lastPositionMs = 0
        lastPacketMs = 0
        if (user) { mode = ""; status = "Disconnected" }
    }

    private fun runBroadcast(port: Int, id: Long) {
        val s = try {
            DatagramSocket(null).apply {
                reuseAddress = true
                broadcast = true
                bind(InetSocketAddress(port))
                soTimeout = 1000
            }
        } catch (t: Throwable) { fail("Cannot listen on UDP $port: ${t.message ?: "port unavailable"}", id); return }
        socket = s
        acquireMulticastLock()
        status = "Listening on UDP $port — enable ‘Broadcast to all mapping apps on the network’ in X-Plane."

        val started = System.currentTimeMillis()
        val buf = ByteArray(8192)
        var attHdg: Double? = null
        var attPitch: Double? = null
        var attRoll: Double? = null
        var attMs = 0L

        while (active(id)) {
            try {
                val p = DatagramPacket(buf, buf.size)
                s.receive(p)
                if (!active(id)) return
                val messages = XPlaneMappingProtocol.parsePacket(p.data, p.length)
                if (messages.isEmpty()) continue
                source = p.address?.hostAddress ?: ""
                lastPacketMs = System.currentTimeMillis()

                messages.forEach { m ->
                    when (m) {
                        is XPlaneMappingMessage.Attitude -> {
                            attHdg = m.trueHeadingDegrees; attPitch = m.pitchDegrees; attRoll = m.rollDegrees; attMs = System.currentTimeMillis()
                            position?.let { old ->
                                position = old.copy(headingDegrees = m.trueHeadingDegrees, pitchDegrees = m.pitchDegrees,
                                    rollDegrees = m.rollDegrees, timestampMillis = System.currentTimeMillis())
                                connected = true; connecting = false; status = ok("X-Plane", source)
                            }
                        }
                        is XPlaneMappingMessage.Gps -> {
                            val fresh = System.currentTimeMillis() - attMs <= ATTITUDE_FRESH
                            accept(SimulatorPosition(m.latitude, m.longitude, m.altitudeMeters,
                                if (fresh) attHdg else m.trackTrueDegrees, m.groundSpeedMps,
                                if (fresh) attPitch else null, if (fresh) attRoll else null), "X-Plane", source, id)
                        }
                    }
                }
            } catch (_: java.net.SocketTimeoutException) {
                val now = System.currentTimeMillis()
                if (connected && now - lastPositionMs >= LIVE_TIMEOUT) {
                    connected = false; connecting = true; position = null
                    status = "X-Plane signal lost — still listening on UDP $port for automatic reconnection."
                } else if (!connected && now - started >= INITIAL_TIMEOUT) {
                    status = "Still listening. In X-Plane enable Other Mapping Apps → Broadcast to all mapping apps on the network."
                }
            } catch (_: SocketException) { if (active(id)) fail("Unable to listen on UDP $port.", id) }
        }
    }

    private fun runRref(host: String, port: Int, id: Long) {
        val target = try { InetAddress.getByName(host) } catch (_: Throwable) { fail("Cannot resolve X-Plane PC address '$host'.", id); return }
        val s = DatagramSocket().apply { soTimeout = 1000 }
        socket = s
        source = host
        val refs = linkedMapOf(1 to "sim/flightmodel/position/latitude", 2 to "sim/flightmodel/position/longitude",
            3 to "sim/flightmodel/position/elevation", 4 to "sim/flightmodel/position/true_psi",
            5 to "sim/flightmodel/position/groundspeed", 6 to "sim/flightmodel/position/theta", 7 to "sim/flightmodel/position/phi")
        try { refs.forEach { (code, ref) -> buildRref(5, code, ref).also { s.send(DatagramPacket(it, it.size, target, port)) } } }
        catch (t: Throwable) { fail("Unable to send X-Plane RREF request: ${t.message ?: "network error"}", id); return }

        status = "Waiting for direct RREF data from $host:$port..."
        val started = System.currentTimeMillis()
        val values = mutableMapOf<Int, Float>()
        val buf = ByteArray(4096)
        while (active(id)) {
            try {
                val p = DatagramPacket(buf, buf.size); s.receive(p); if (!active(id)) return
                if (p.length < 13 || buf[0].toInt() != 'R'.code || buf[1].toInt() != 'R'.code || buf[2].toInt() != 'R'.code || buf[3].toInt() != 'F'.code) continue
                source = p.address?.hostAddress ?: host; lastPacketMs = System.currentTimeMillis()
                var o = 5
                while (o + 8 <= p.length) {
                    val code = ByteBuffer.wrap(buf, o, 4).order(ByteOrder.LITTLE_ENDIAN).int
                    values[code] = ByteBuffer.wrap(buf, o + 4, 4).order(ByteOrder.LITTLE_ENDIAN).float; o += 8
                }
                val lat = values[1]?.toDouble(); val lon = values[2]?.toDouble()
                if (lat != null && lon != null && lat in -90.0..90.0 && lon in -180.0..180.0)
                    accept(SimulatorPosition(lat, lon, values[3]?.toDouble(), values[4]?.toDouble(), values[5]?.toDouble(),
                        values[6]?.toDouble(), values[7]?.toDouble()), "X-Plane direct", source, id)
            } catch (_: java.net.SocketTimeoutException) {
                checkTimeout(started, "No RREF response. Confirm PC IP and X-Plane Network → UDP Ports → Port we receive on.", id)
            } catch (_: SocketException) { if (active(id)) fail("X-Plane UDP socket closed.", id) }
        }
    }

    private fun runBridge(port: Int, label: String, id: Long) {
        val s = try { DatagramSocket(port).apply { soTimeout = 1000 } }
        catch (t: Throwable) { fail("Cannot listen on UDP $port: ${t.message ?: "port unavailable"}", id); return }
        socket = s
        status = "Waiting for $label bridge on UDP $port..."
        val started = System.currentTimeMillis(); val buf = ByteArray(8192)
        while (active(id)) {
            try {
                val p = DatagramPacket(buf, buf.size); s.receive(p); if (!active(id)) return
                val j = try { JSONObject(String(p.data, p.offset, p.length, Charsets.UTF_8)) } catch (_: Throwable) { continue }
                val lat = if (j.has("lat")) j.optDouble("lat", Double.NaN) else j.optDouble("latitude", Double.NaN)
                val lon = if (j.has("lon")) j.optDouble("lon", Double.NaN) else j.optDouble("longitude", Double.NaN)
                if (lat.isNaN() || lon.isNaN() || lat !in -90.0..90.0 || lon !in -180.0..180.0) continue
                val alt = if (j.has("alt")) j.optDouble("alt", Double.NaN) else j.optDouble("altitude", Double.NaN)
                val hdg = j.optDouble("heading", Double.NaN); source = p.address?.hostAddress ?: ""
                accept(SimulatorPosition(lat, lon, alt.takeUnless { it.isNaN() }, hdg.takeUnless { it.isNaN() }), "$label bridge", source, id)
            } catch (_: java.net.SocketTimeoutException) { checkTimeout(started, "No valid $label bridge data received.", id) }
            catch (_: SocketException) { if (active(id)) fail("$label UDP socket closed.", id) }
        }
    }

    private fun accept(v: SimulatorPosition, label: String, src: String, id: Long) {
        if (!active(id)) return
        position = v; lastPositionMs = System.currentTimeMillis(); lastPacketMs = lastPositionMs
        if (src.isNotBlank()) source = src
        connected = true; connecting = false; status = ok(label, source)
    }

    private fun checkTimeout(started: Long, reason: String, id: Long) {
        if (!active(id)) return
        val now = System.currentTimeMillis()
        if (connected && now - lastPositionMs >= LIVE_TIMEOUT) lost("No simulator position data for ${LIVE_TIMEOUT / 1000}s.", id)
        else if (connecting && now - started >= INITIAL_TIMEOUT) fail(reason, id)
    }

    private fun fail(reason: String, id: Long) {
        if (session != id) return
        connected = false; connecting = false; position = null; running = false; status = "Connection failed: $reason"
        try { socket?.close() } catch (_: Throwable) {}
    }

    private fun lost(reason: String, id: Long) {
        if (session != id) return
        val notify = connected
        connected = false; connecting = false; position = null; running = false; status = "Disconnected: $reason"
        try { socket?.close() } catch (_: Throwable) {}
        if (notify) appContext?.let { c -> Handler(Looper.getMainLooper()).post { Toast.makeText(c, "Simulator disconnected\n$reason", Toast.LENGTH_LONG).show() } }
    }

    private fun active(id: Long) = running && session == id
    private fun ok(label: String, src: String) = if (src.isBlank()) "✓ Connected to $label" else "✓ Connected to $label • $src"
    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun acquireMulticastLock() {
        try {
            val wm = appContext?.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            multicastLock = wm?.createMulticastLock("JEPPIRAN-XPlane")?.apply { setReferenceCounted(false); acquire() }
        } catch (_: Throwable) { multicastLock = null }
    }

    private fun releaseMulticastLock() {
        try { multicastLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
        multicastLock = null
    }

    private fun buildRref(freq: Int, code: Int, ref: String): ByteArray {
        val data = ByteArray(413)
        data[0] = 'R'.code.toByte(); data[1] = 'R'.code.toByte(); data[2] = 'E'.code.toByte(); data[3] = 'F'.code.toByte(); data[4] = 0
        ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN).apply { position(5); putInt(freq); putInt(code) }
        val bytes = ref.toByteArray(Charsets.UTF_8); val n = minOf(bytes.size, 399)
        System.arraycopy(bytes, 0, data, 13, n); data[13 + n] = 0
        return data
    }
}
