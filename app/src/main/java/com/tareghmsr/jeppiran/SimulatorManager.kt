package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

object SimulatorManager {
    private const val PREFS = "jeppiran_preferences"
    private const val KEY_SIMULATOR = "simulator_type"
    private const val KEY_HOST = "simulator_host"
    private const val KEY_PORT = "simulator_port"
    private const val DEFAULT_PORT = 49731

    const val NONE = "none"
    const val XPLANE = "xplane"
    const val MSFS2020 = "msfs2020"
    const val MSFS2024 = "msfs2024"
    const val PREPAR3D = "prepar3d"

    data class Position(
        val latitude: Double,
        val longitude: Double,
        val altitudeFeet: Double,
        val headingDegrees: Double,
        val groundSpeedKnots: Double,
        val timestampMillis: Long = System.currentTimeMillis()
    )

    private var socket: DatagramSocket? = null
    private var worker: Thread? = null
    private val running = AtomicBoolean(false)
    @Volatile private var latest: Position? = null
    @Volatile private var connected = false

    fun simulator(context: Context): String =
        prefs(context).getString(KEY_SIMULATOR, NONE) ?: NONE

    fun host(context: Context): String =
        prefs(context).getString(KEY_HOST, "") ?: ""

    fun port(context: Context): Int =
        prefs(context).getInt(KEY_PORT, DEFAULT_PORT)

    fun saveConfiguration(context: Context, simulator: String, host: String, port: Int) {
        prefs(context).edit()
            .putString(KEY_SIMULATOR, simulator)
            .putString(KEY_HOST, host.trim())
            .putInt(KEY_PORT, port)
            .apply()
    }

    fun latestPosition(): Position? = latest

    fun isConnected(): Boolean = connected

    fun start(context: Context, onPosition: (Position) -> Unit, onState: (Boolean) -> Unit = {}) {
        stop()
        val host = host(context)
        val configuredPort = port(context)
        running.set(true)
        connected = false

        worker = thread(name = "JeppIran-Simulator") {
            try {
                socket = DatagramSocket(null).apply {
                    reuseAddress = true
                    bind(InetSocketAddress(configuredPort))
                    soTimeout = 1500
                }

                val buffer = ByteArray(8192)
                while (running.get()) {
                    try {
                        val packet = DatagramPacket(buffer, buffer.size)
                        socket?.receive(packet)
                        val text = String(packet.data, packet.offset, packet.length, Charsets.UTF_8)
                        val position = parsePosition(text) ?: continue
                        latest = position
                        connected = true
                        onPosition(position)
                        onState(true)
                    } catch (_: java.net.SocketTimeoutException) {
                        if (connected && latest != null &&
                            System.currentTimeMillis() - latest!!.timestampMillis > 5000L) {
                            connected = false
                            onState(false)
                        }
                    }
                }
            } catch (_: Exception) {
                connected = false
                onState(false)
            } finally {
                try { socket?.close() } catch (_: Exception) {}
                socket = null
                connected = false
                onState(false)
            }
        }
    }

    fun stop() {
        running.set(false)
        try { socket?.close() } catch (_: Exception) {}
        socket = null
        worker = null
        connected = false
    }

    private fun parsePosition(text: String): Position? {
        return try {
            val json = JSONObject(text)
            val lat = json.optDouble("latitude", Double.NaN)
            val lon = json.optDouble("longitude", Double.NaN)
            val alt = json.optDouble("altitude_ft", 0.0)
            val heading = json.optDouble("heading_deg", 0.0)
            val speed = json.optDouble("ground_speed_kt", 0.0)
            if (!lat.isFinite() || !lon.isFinite() || lat !in -90.0..90.0 || lon !in -180.0..180.0) {
                null
            } else {
                Position(lat, lon, alt, heading, speed)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
