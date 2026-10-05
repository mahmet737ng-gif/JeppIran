package com.tareghmsr.jeppiran

import android.content.Context
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject
import kotlin.concurrent.thread

data class SimulatorPosition(
    val latitude: Double,
    val longitude: Double,
    val altitudeMeters: Double?,
    val headingDegrees: Double?,
    val timestampMillis: Long = System.currentTimeMillis()
)

object SimulatorLocationStore {
    const val TYPE_XPLANE = "X-Plane 11 / 12"
    const val TYPE_MSFS = "Microsoft Flight Simulator 2020 / 2024"

    private const val PREFS = "simulator_connection"
    private const val PREF_TYPE = "type"
    private const val PREF_HOST = "host"
    private const val PREF_PORT = "port"

    @Volatile private var position: SimulatorPosition? = null
    @Volatile private var connected = false
    @Volatile private var status = "Disconnected"

    private var worker: Thread? = null
    private var socket: DatagramSocket? = null
    private val running = AtomicBoolean(false)

    fun isConnected(): Boolean = connected
    fun getPosition(): SimulatorPosition? = position
    fun getStatus(): String = status

    fun savedType(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(PREF_TYPE, TYPE_XPLANE) ?: TYPE_XPLANE

    fun savedHost(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(PREF_HOST, "192.168.1.100") ?: "192.168.1.100"

    fun savedPort(context: Context): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getInt(PREF_PORT, 49000)

    fun saveSettings(context: Context, type: String, host: String, port: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(PREF_TYPE, type).putString(PREF_HOST, host)
            .putInt(PREF_PORT, port).apply()
    }

    @Synchronized
    fun connect(context: Context, type: String, host: String, port: Int) {
        disconnect()
        saveSettings(context, type, host, port)
        running.set(true)
        connected = true
        position = null
        status = "Connecting..."

        worker = thread(name = "JeppIran-Simulator") {
            try {
                if (type == TYPE_XPLANE) runXPlane(host, port) else runMsfs()
            } catch (t: Throwable) {
                if (running.get()) {
                    status = "Connection error: ${t.message ?: "unknown error"}"
                }
            } finally {
                if (running.get()) {
                    status = "Disconnected"
                    connected = false
                }
            }
        }
    }

    @Synchronized
    fun disconnect() {
        running.set(false)
        try { socket?.close() } catch (_: Throwable) {}
        socket = null
        worker?.interrupt()
        worker = null
        connected = false
        position = null
        status = "Disconnected"
    }

    private fun runXPlane(host: String, port: Int) {
        val target = InetAddress.getByName(host)
        val s = DatagramSocket()
        socket = s
        s.soTimeout = 2000

        val refs = linkedMapOf(
            1 to "sim/flightmodel/position/latitude",
            2 to "sim/flightmodel/position/longitude",
            3 to "sim/flightmodel/position/elevation",
            4 to "sim/flightmodel/position/true_psi"
        )

        refs.forEach { (code, dataref) ->
            val request = buildRrefPacket(1, code, dataref)
            s.send(DatagramPacket(request, request.size, target, port))
        }

        status = "Connected to X-Plane"
        val values = mutableMapOf<Int, Float>()
        val buffer = ByteArray(2048)

        while (running.get()) {
            try {
                val packet = DatagramPacket(buffer, buffer.size)
                s.receive(packet)
                if (packet.length < 13) continue
                if (buffer[0].toInt() != 'R'.code ||
                    buffer[1].toInt() != 'R'.code ||
                    buffer[2].toInt() != 'R'.code ||
                    buffer[3].toInt() != 'F'.code) continue

                var offset = 5
                while (offset + 8 <= packet.length) {
                    val code = ByteBuffer.wrap(buffer, offset, 4)
                        .order(ByteOrder.LITTLE_ENDIAN).int
                    val value = ByteBuffer.wrap(buffer, offset + 4, 4)
                        .order(ByteOrder.LITTLE_ENDIAN).float
                    values[code] = value
                    offset += 8
                }

                val lat = values[1]?.toDouble()
                val lon = values[2]?.toDouble()
                if (lat != null && lon != null &&
                    lat in -90.0..90.0 && lon in -180.0..180.0) {
                    position = SimulatorPosition(
                        lat, lon, values[3]?.toDouble(), values[4]?.toDouble()
                    )
                    status = "X-Plane connected"
                }
            } catch (_: java.net.SocketTimeoutException) {}
        }
    }

    private fun buildRrefPacket(freq: Int, code: Int, dataref: String): ByteArray {
        val data = ByteArray(413)
        data[0] = 'R'.code.toByte()
        data[1] = 'R'.code.toByte()
        data[2] = 'E'.code.toByte()
        data[3] = 'F'.code.toByte()
        data[4] = 0

        val bb = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        bb.position(5)
        bb.putInt(freq)
        bb.putInt(code)

        val bytes = dataref.toByteArray(Charsets.UTF_8)
        val count = minOf(bytes.size, 399)
        System.arraycopy(bytes, 0, data, 13, count)
        data[13 + count] = 0
        return data
    }

    private fun runMsfs() {
        val s = DatagramSocket(49010)
        socket = s
        s.soTimeout = 2000
        status = "Listening for MSFS bridge on UDP 49010"

        val buffer = ByteArray(8192)
        while (running.get()) {
            try {
                val packet = DatagramPacket(buffer, buffer.size)
                s.receive(packet)
                val json = JSONObject(
                    String(packet.data, packet.offset, packet.length, Charsets.UTF_8)
                )

                val lat = if (json.has("lat")) json.optDouble("lat", Double.NaN)
                    else json.optDouble("latitude", Double.NaN)
                val lon = if (json.has("lon")) json.optDouble("lon", Double.NaN)
                    else json.optDouble("longitude", Double.NaN)

                if (lat.isNaN() || lon.isNaN()) continue
                if (lat !in -90.0..90.0 || lon !in -180.0..180.0) continue

                val altitude = if (json.has("alt")) json.optDouble("alt", Double.NaN)
                    else json.optDouble("altitude", Double.NaN)
                val heading = json.optDouble("heading", Double.NaN)

                position = SimulatorPosition(
                    lat, lon,
                    altitude.takeUnless { it.isNaN() },
                    heading.takeUnless { it.isNaN() }
                )
                status = "MSFS bridge connected"
            } catch (_: java.net.SocketTimeoutException) {
            } catch (_: org.json.JSONException) {
            }
        }
    }
}
