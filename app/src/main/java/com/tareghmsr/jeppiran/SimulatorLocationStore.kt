package com.tareghmsr.jeppiran

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketException
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
    const val TYPE_P3D = "Prepar3D v4 / v5 / v6"

    private const val PREFS = "simulator_connection"
    private const val PREF_TYPE = "type"
    private const val PREF_HOST = "host"
    private const val PREF_PORT = "port"

    private const val INITIAL_RESPONSE_TIMEOUT_MS = 8000L
    private const val LIVE_DATA_TIMEOUT_MS = 5000L
    private const val SOCKET_POLL_TIMEOUT_MS = 1000

    @Volatile private var position: SimulatorPosition? = null
    @Volatile private var connected = false
    @Volatile private var connecting = false
    @Volatile private var status = "Disconnected"
    @Volatile private var lastPacketMillis = 0L

    private var worker: Thread? = null
    private var socket: DatagramSocket? = null
    private val running = AtomicBoolean(false)
    private var appContext: Context? = null

    fun isConnected(): Boolean = connected
    fun isConnecting(): Boolean = connecting
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
            .edit()
            .putString(PREF_TYPE, type)
            .putString(PREF_HOST, host)
            .putInt(PREF_PORT, port)
            .apply()
    }

    @Synchronized
    fun connect(context: Context, type: String, host: String, port: Int) {
        disconnectInternal(userInitiated = true)

        appContext = context.applicationContext
        saveSettings(context, type, host, port)

        position = null
        connected = false
        connecting = true
        lastPacketMillis = 0L
        running.set(true)

        status = when (type) {
            TYPE_XPLANE -> "Testing X-Plane connection..."
            TYPE_MSFS -> "Waiting for valid MSFS bridge data..."
            TYPE_P3D -> "Waiting for valid Prepar3D bridge data..."
            else -> "Testing simulator connection..."
        }

        worker = thread(name = "JeppIran-Simulator") {
            try {
                when (type) {
                    TYPE_XPLANE -> runXPlane(host, port)
                    TYPE_MSFS -> runBridge(port, "MSFS")
                    TYPE_P3D -> runBridge(port, "Prepar3D")
                    else -> initialFailure("Unsupported simulator: $type")
                }
            } catch (t: Throwable) {
                if (running.get()) {
                    if (connected) {
                        connectionLost(t.message ?: "network error")
                    } else {
                        initialFailure(t.message ?: "network error")
                    }
                }
            } finally {
                try { socket?.close() } catch (_: Throwable) {}
                socket = null
                worker = null
            }
        }
    }

    @Synchronized
    fun disconnect() {
        disconnectInternal(userInitiated = true)
    }

    @Synchronized
    private fun disconnectInternal(userInitiated: Boolean) {
        running.set(false)
        try { socket?.close() } catch (_: Throwable) {}
        socket = null
        worker?.interrupt()
        worker = null
        connected = false
        connecting = false
        position = null
        lastPacketMillis = 0L
        if (userInitiated) {
            status = "Disconnected"
        }
    }

    private fun runXPlane(host: String, port: Int) {
        val target = try {
            InetAddress.getByName(host)
        } catch (_: Throwable) {
            initialFailure("Cannot resolve X-Plane PC address '$host'.")
            return
        }

        val s = DatagramSocket()
        socket = s
        s.soTimeout = SOCKET_POLL_TIMEOUT_MS

        val refs = linkedMapOf(
            1 to "sim/flightmodel/position/latitude",
            2 to "sim/flightmodel/position/longitude",
            3 to "sim/flightmodel/position/elevation",
            4 to "sim/flightmodel/position/true_psi"
        )

        try {
            refs.forEach { (code, dataref) ->
                val request = buildRrefPacket(2, code, dataref)
                s.send(DatagramPacket(request, request.size, target, port))
            }
        } catch (t: Throwable) {
            initialFailure("Unable to send X-Plane RREF request: ${t.message ?: "network error"}")
            return
        }

        val started = System.currentTimeMillis()
        val values = mutableMapOf<Int, Float>()
        val buffer = ByteArray(2048)

        while (running.get()) {
            try {
                val packet = DatagramPacket(buffer, buffer.size)
                s.receive(packet)

                if (packet.length < 13) continue
                if (
                    buffer[0].toInt() != 'R'.code ||
                    buffer[1].toInt() != 'R'.code ||
                    buffer[2].toInt() != 'R'.code ||
                    buffer[3].toInt() != 'F'.code
                ) continue

                var offset = 5
                while (offset + 8 <= packet.length) {
                    val code = ByteBuffer.wrap(buffer, offset, 4)
                        .order(ByteOrder.LITTLE_ENDIAN)
                        .int
                    val value = ByteBuffer.wrap(buffer, offset + 4, 4)
                        .order(ByteOrder.LITTLE_ENDIAN)
                        .float
                    values[code] = value
                    offset += 8
                }

                val lat = values[1]?.toDouble()
                val lon = values[2]?.toDouble()
                if (
                    lat != null &&
                    lon != null &&
                    lat in -90.0..90.0 &&
                    lon in -180.0..180.0
                ) {
                    acceptPosition(
                        SimulatorPosition(
                            lat,
                            lon,
                            values[3]?.toDouble(),
                            values[4]?.toDouble()
                        ),
                        "X-Plane"
                    )
                }
            } catch (_: java.net.SocketTimeoutException) {
                checkLiveness(
                    started,
                    "No valid RREF response from X-Plane. Check PC IP, UDP port, same LAN and firewall."
                )
            } catch (_: SocketException) {
                if (running.get()) {
                    if (connected) {
                        connectionLost("X-Plane UDP socket closed.")
                    } else {
                        initialFailure("Unable to open X-Plane UDP connection.")
                    }
                }
            }
        }
    }

    private fun runBridge(port: Int, simulatorLabel: String) {
        val s = try {
            DatagramSocket(port)
        } catch (t: Throwable) {
            initialFailure("Cannot listen on UDP $port: ${t.message ?: "port unavailable"}")
            return
        }

        socket = s
        s.soTimeout = SOCKET_POLL_TIMEOUT_MS
        status = "Testing $simulatorLabel bridge on UDP $port..."
        val started = System.currentTimeMillis()
        val buffer = ByteArray(8192)

        while (running.get()) {
            try {
                val packet = DatagramPacket(buffer, buffer.size)
                s.receive(packet)

                val json = try {
                    JSONObject(
                        String(
                            packet.data,
                            packet.offset,
                            packet.length,
                            Charsets.UTF_8
                        )
                    )
                } catch (_: org.json.JSONException) {
                    continue
                }

                val lat =
                    if (json.has("lat")) json.optDouble("lat", Double.NaN)
                    else json.optDouble("latitude", Double.NaN)

                val lon =
                    if (json.has("lon")) json.optDouble("lon", Double.NaN)
                    else json.optDouble("longitude", Double.NaN)

                if (
                    lat.isNaN() ||
                    lon.isNaN() ||
                    lat !in -90.0..90.0 ||
                    lon !in -180.0..180.0
                ) continue

                val altitude =
                    if (json.has("alt")) json.optDouble("alt", Double.NaN)
                    else json.optDouble("altitude", Double.NaN)

                val heading = json.optDouble("heading", Double.NaN)

                acceptPosition(
                    SimulatorPosition(
                        lat,
                        lon,
                        altitude.takeUnless { it.isNaN() },
                        heading.takeUnless { it.isNaN() }
                    ),
                    "$simulatorLabel bridge"
                )
            } catch (_: java.net.SocketTimeoutException) {
                checkLiveness(
                    started,
                    "No valid $simulatorLabel bridge data received. Start the bridge, verify Android IP/UDP port, LAN and Windows Firewall."
                )
            } catch (_: SocketException) {
                if (running.get()) {
                    if (connected) {
                        connectionLost("$simulatorLabel UDP socket closed.")
                    } else {
                        initialFailure("Unable to listen for $simulatorLabel bridge data.")
                    }
                }
            }
        }
    }

    private fun acceptPosition(value: SimulatorPosition, label: String) {
        position = value
        lastPacketMillis = System.currentTimeMillis()

        if (!connected) {
            connected = true
            connecting = false
        }

        status = "✓ Connected to $label"
    }

    private fun checkLiveness(started: Long, initialReason: String) {
        val now = System.currentTimeMillis()

        if (connected) {
            if (
                lastPacketMillis > 0L &&
                now - lastPacketMillis >= LIVE_DATA_TIMEOUT_MS
            ) {
                connectionLost(
                    "No simulator position data for ${LIVE_DATA_TIMEOUT_MS / 1000}s. Check simulator/bridge, LAN and firewall."
                )
            }
        } else if (
            connecting &&
            now - started >= INITIAL_RESPONSE_TIMEOUT_MS
        ) {
            initialFailure(initialReason)
        }
    }

    private fun initialFailure(reason: String) {
        if (!running.get() && !connecting) return
        connected = false
        connecting = false
        position = null
        status = "Connection failed: $reason"
        running.set(false)
        try { socket?.close() } catch (_: Throwable) {}
    }

    private fun connectionLost(reason: String) {
        val shouldNotify = connected
        connected = false
        connecting = false
        position = null
        status = "Disconnected: $reason"
        running.set(false)
        try { socket?.close() } catch (_: Throwable) {}

        if (shouldNotify) {
            notifyGlobalDisconnect(reason)
        }
    }

    private fun notifyGlobalDisconnect(reason: String) {
        val context = appContext ?: return
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(
                context,
                "Simulator disconnected\n$reason",
                Toast.LENGTH_LONG
            ).show()
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
}
