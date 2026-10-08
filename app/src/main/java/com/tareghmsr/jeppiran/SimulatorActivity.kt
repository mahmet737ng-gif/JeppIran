package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections
import java.util.Locale

class SimulatorActivity : AppCompatActivity() {
    private lateinit var root: LinearLayout
    private lateinit var content: LinearLayout

    private var statusText: TextView? = null
    private var positionText: TextView? = null
    private var quickButton: Button? = null
    private var directButton: Button? = null
    private var bridgeButton: Button? = null
    private var directHostInput: EditText? = null
    private var directPortInput: EditText? = null
    private var bridgePortInput: EditText? = null

    private var selectedType = SimulatorLocationStore.TYPE_XPLANE
    private var autoStartedThisOpen = false

    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() {
            refreshStatus()
            handler.postDelayed(this, 500L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        selectedType = SimulatorLocationStore.savedType(this)
        buildUi()
        handler.post(refreshRunnable)
        autoStartXPlaneIfNeeded()
    }

    override fun onDestroy() {
        handler.removeCallbacks(refreshRunnable)
        super.onDestroy()
    }

    private fun buildUi() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = getDrawable(R.drawable.bg_flight_deck)
        }

        val scroll = ScrollView(this).apply {
            isFillViewport = true
        }

        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp, 18.dp, 20.dp, 32.dp)
        }

        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        BackNavigation.install(this)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(root)

        renderContent()
    }

    private fun renderContent() {
        content.removeAllViews()
        statusText = null
        positionText = null
        quickButton = null
        directButton = null
        bridgeButton = null
        directHostInput = null
        directPortInput = null
        bridgePortInput = null

        content.addView(TextView(this).apply {
            text = "CONNECT TO SIMULATOR"
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(textColor())
        })

        content.addView(TextView(this).apply {
            text = "Use simulator aircraft position on georeferenced JEPPIRAN charts instead of the phone GPS."
            textSize = 13f
            setTextColor(secondaryTextColor())
            setPadding(0, 6.dp, 0, 18.dp)
        })

        content.addView(sectionTitle("SIMULATOR"))
        content.addView(TextView(this).apply {
            text = selectedType
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER_VERTICAL
            setTextColor(textColor())
            setPadding(16.dp, 0, 16.dp, 0)
            background = roundedSurface()
            setOnClickListener { chooseSimulator() }
        }, lp(58))

        content.addView(sectionTitle("LIVE STATUS"))
        val statusCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 14.dp, 16.dp, 14.dp)
            background = roundedSurface()
        }

        statusText = TextView(this).apply {
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(secondaryTextColor())
        }
        statusCard.addView(statusText)

        positionText = TextView(this).apply {
            textSize = 14f
            typeface = Typeface.MONOSPACE
            setTextColor(textColor())
            setPadding(0, 10.dp, 0, 0)
        }
        statusCard.addView(positionText)
        content.addView(statusCard, lpWrap(0, 4, 0, 8))

        if (selectedType == SimulatorLocationStore.TYPE_XPLANE) {
            renderXPlane()
        } else {
            renderBridgeSimulator()
        }

        refreshStatus()
    }

    private fun renderXPlane() {
        content.addView(sectionTitle("QUICK CONNECT — RECOMMENDED"))

        val quickCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 16.dp, 16.dp, 16.dp)
            background = roundedSurface()
        }

        quickCard.addView(TextView(this).apply {
            text = "NO WINDOWS CONNECTOR REQUIRED"
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(accentColor())
        })

        quickCard.addView(TextView(this).apply {
            text = "JEPPIRAN can receive X-Plane’s built-in mapping-app broadcast directly. The normal connection needs no PC IP address and no extra program."
            textSize = 13f
            setTextColor(textColor())
            setLineSpacing(3f, 1.04f)
            setPadding(0, 8.dp, 0, 14.dp)
        })

        quickCard.addView(step("1", "Put the X-Plane PC and this device on the same Wi-Fi/LAN."))
        quickCard.addView(step("2", "In X-Plane open Settings → Network → iPhone, iPad and External Apps."))
        quickCard.addView(step("3", "Under Other Mapping Apps, enable “Broadcast to all mapping apps on the network”."))
        quickCard.addView(step("4", "Return here. JEPPIRAN listens on UDP 49002 and connects automatically when the first valid XGPS packet arrives."))

        quickCard.addView(TextView(this).apply {
            text = "This device: ${localIpAddress()}   •   Mapping UDP: ${SimulatorLocationStore.savedXPlaneMappingPort(this@SimulatorActivity)}"
            textSize = 12f
            setTextColor(secondaryTextColor())
            setPadding(0, 12.dp, 0, 4.dp)
        })

        quickButton = Button(this).apply {
            text = "START AUTO CONNECT"
            setOnClickListener {
                val mode = SimulatorLocationStore.getConnectionMode()
                if ((SimulatorLocationStore.isConnected() || SimulatorLocationStore.isConnecting()) &&
                    mode == SimulatorLocationStore.MODE_XPLANE_BROADCAST
                ) {
                    SimulatorLocationStore.disconnect()
                } else {
                    SimulatorLocationStore.connectXPlaneBroadcast(
                        this@SimulatorActivity,
                        SimulatorLocationStore.savedXPlaneMappingPort(this@SimulatorActivity)
                    )
                }
                refreshStatus()
            }
        }
        quickCard.addView(quickButton, lp(52, 0, 12, 0, 0))
        content.addView(quickCard, lpWrap(0, 4, 0, 10))

        content.addView(sectionTitle("ADVANCED FALLBACK — DIRECT RREF"))

        val advancedCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 16.dp, 16.dp, 16.dp)
            background = roundedSurface()
        }

        advancedCard.addView(TextView(this).apply {
            text = "Use this only if your router/firewall blocks the mapping broadcast. Enter the X-Plane PC IPv4 address and the exact value shown in X-Plane → Network → UDP Ports → “Port we receive on”."
            textSize = 13f
            setTextColor(textColor())
            setLineSpacing(3f, 1.04f)
            setPadding(0, 0, 0, 10.dp)
        })

        directHostInput = EditText(this).apply {
            hint = "X-Plane PC IPv4, e.g. 192.168.1.50"
            setText(SimulatorLocationStore.savedHost(this@SimulatorActivity))
            textSize = 15f
            inputType = InputType.TYPE_CLASS_TEXT
            setSingleLine(true)
            setTextColor(textColor())
            setHintTextColor(secondaryTextColor())
            background = roundedSurface()
            setPadding(14.dp, 0, 14.dp, 0)
        }
        advancedCard.addView(directHostInput, lp(54))

        directPortInput = EditText(this).apply {
            hint = "Port we receive on"
            setText(SimulatorLocationStore.savedXPlaneRrefPort(this@SimulatorActivity).toString())
            textSize = 15f
            inputType = InputType.TYPE_CLASS_NUMBER
            setSingleLine(true)
            setTextColor(textColor())
            setHintTextColor(secondaryTextColor())
            background = roundedSurface()
            setPadding(14.dp, 0, 14.dp, 0)
        }
        advancedCard.addView(directPortInput, lp(54, 0, 8, 0, 0))

        directButton = Button(this).apply {
            text = "CONNECT DIRECT"
            setOnClickListener { connectDirectXPlane() }
        }
        advancedCard.addView(directButton, lp(52, 0, 10, 0, 0))

        advancedCard.addView(TextView(this).apply {
            text = "Direct mode requests latitude, longitude, altitude, true heading, groundspeed, pitch and roll at 5 Hz using X-Plane RREF/UDP."
            textSize = 12f
            setTextColor(secondaryTextColor())
            setPadding(0, 10.dp, 0, 0)
        })

        content.addView(advancedCard, lpWrap(0, 4, 0, 10))

        content.addView(TextView(this).apply {
            text = "Connection priority: X-Plane simulator position → phone GPS fallback. When simulator data is live, JEPPIRAN stops requesting phone GPS until the simulator source is disconnected."
            textSize = 12f
            setTextColor(secondaryTextColor())
            setPadding(2.dp, 10.dp, 2.dp, 0)
        })
    }

    private fun renderBridgeSimulator() {
        content.addView(sectionTitle("CONNECTION"))

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 16.dp, 16.dp, 16.dp)
            background = roundedSurface()
        }

        val defaultPort = if (selectedType == SimulatorLocationStore.TYPE_MSFS) 49010 else 49011
        val saved = SimulatorLocationStore.savedPort(this)

        bridgePortInput = EditText(this).apply {
            hint = "UDP port"
            setText((if (saved in 1..65535) saved else defaultPort).toString())
            textSize = 15f
            inputType = InputType.TYPE_CLASS_NUMBER
            setSingleLine(true)
            setTextColor(textColor())
            setHintTextColor(secondaryTextColor())
            background = roundedSurface()
            setPadding(14.dp, 0, 14.dp, 0)
        }
        card.addView(bridgePortInput, lp(54))

        bridgeButton = Button(this).apply {
            text = "CONNECT"
            setOnClickListener { connectBridge() }
        }
        card.addView(bridgeButton, lp(52, 0, 10, 0, 0))

        card.addView(TextView(this).apply {
            text = buildBridgeGuide(defaultPort)
            textSize = 13f
            setTextColor(textColor())
            setLineSpacing(3f, 1.04f)
            setPadding(0, 12.dp, 0, 0)
        })

        content.addView(card, lpWrap(0, 4, 0, 8))
    }

    private fun autoStartXPlaneIfNeeded() {
        if (autoStartedThisOpen || selectedType != SimulatorLocationStore.TYPE_XPLANE) return
        if (SimulatorLocationStore.isConnected() || SimulatorLocationStore.isConnecting()) return

        autoStartedThisOpen = true
        handler.postDelayed({
            if (!isFinishing && selectedType == SimulatorLocationStore.TYPE_XPLANE &&
                !SimulatorLocationStore.isConnected() && !SimulatorLocationStore.isConnecting()
            ) {
                val savedMode = SimulatorLocationStore.savedXPlaneMode(this)
                val savedHost = SimulatorLocationStore.savedHost(this).trim()
                if (savedMode == SimulatorLocationStore.MODE_XPLANE_RREF && savedHost.isNotBlank()) {
                    SimulatorLocationStore.connectXPlaneDirect(
                        this,
                        savedHost,
                        SimulatorLocationStore.savedXPlaneRrefPort(this)
                    )
                } else {
                    SimulatorLocationStore.connectXPlaneBroadcast(
                        this,
                        SimulatorLocationStore.savedXPlaneMappingPort(this)
                    )
                }
                refreshStatus()
            }
        }, 350L)
    }

    private fun chooseSimulator() {
        val items = arrayOf(
            SimulatorLocationStore.TYPE_XPLANE,
            SimulatorLocationStore.TYPE_MSFS,
            SimulatorLocationStore.TYPE_P3D
        )

        android.app.AlertDialog.Builder(this)
            .setTitle("Select simulator")
            .setItems(items) { _, which ->
                val next = items[which]
                if (next != selectedType) SimulatorLocationStore.disconnect()
                selectedType = next
                SimulatorLocationStore.saveSettings(
                    this,
                    selectedType,
                    SimulatorLocationStore.savedHost(this),
                    when (selectedType) {
                        SimulatorLocationStore.TYPE_MSFS -> 49010
                        SimulatorLocationStore.TYPE_P3D -> 49011
                        else -> SimulatorLocationStore.savedXPlaneRrefPort(this)
                    }
                )
                renderContent()
                if (selectedType == SimulatorLocationStore.TYPE_XPLANE) {
                    autoStartedThisOpen = false
                    autoStartXPlaneIfNeeded()
                }
            }
            .show()
    }

    private fun connectDirectXPlane() {
        if ((SimulatorLocationStore.isConnected() || SimulatorLocationStore.isConnecting()) &&
            SimulatorLocationStore.getConnectionMode() == SimulatorLocationStore.MODE_XPLANE_RREF
        ) {
            SimulatorLocationStore.disconnect()
            refreshStatus()
            return
        }

        val host = directHostInput?.text?.toString()?.trim().orEmpty()
        val port = directPortInput?.text?.toString()?.toIntOrNull()

        if (host.isBlank()) {
            statusText?.text = "Enter the X-Plane PC IPv4 address for Direct RREF mode."
            return
        }
        if (port == null || port !in 1..65535) {
            statusText?.text = "Enter a valid X-Plane ‘Port we receive on’ value."
            return
        }

        SimulatorLocationStore.connectXPlaneDirect(this, host, port)
        refreshStatus()
    }

    private fun connectBridge() {
        if (SimulatorLocationStore.isConnected() || SimulatorLocationStore.isConnecting()) {
            SimulatorLocationStore.disconnect()
            refreshStatus()
            return
        }

        val port = bridgePortInput?.text?.toString()?.toIntOrNull()
        if (port == null || port !in 1..65535) {
            statusText?.text = "Enter a valid UDP port."
            return
        }

        SimulatorLocationStore.connect(this, selectedType, "", port)
        refreshStatus()
    }

    private fun refreshStatus() {
        val connected = SimulatorLocationStore.isConnected()
        val connecting = SimulatorLocationStore.isConnecting()
        val mode = SimulatorLocationStore.getConnectionMode()
        val status = SimulatorLocationStore.getStatus()

        statusText?.apply {
            text = status
            setTextColor(
                when {
                    connected -> Color.rgb(90, 230, 150)
                    connecting -> accentColor()
                    status.startsWith("Connection failed") || status.startsWith("Disconnected:") ->
                        Color.rgb(255, 115, 125)
                    else -> secondaryTextColor()
                }
            )
        }

        quickButton?.text = when {
            (connected || connecting) && mode == SimulatorLocationStore.MODE_XPLANE_BROADCAST -> "STOP LISTENING"
            connected || connecting -> "SWITCH TO AUTO CONNECT"
            else -> "START AUTO CONNECT"
        }

        directButton?.text = when {
            (connected || connecting) && mode == SimulatorLocationStore.MODE_XPLANE_RREF -> "DISCONNECT DIRECT"
            connected || connecting -> "SWITCH TO DIRECT RREF"
            else -> "CONNECT DIRECT"
        }

        bridgeButton?.text = if (connected || connecting) "DISCONNECT" else "CONNECT"

        val p = SimulatorLocationStore.getPosition()
        positionText?.text = if (p == null) {
            buildString {
                append("Position: waiting for simulator data")
                if (mode.isNotBlank()) append("\nMode: ").append(mode)
                val source = SimulatorLocationStore.getSourceAddress()
                if (source.isNotBlank()) append("\nSource: ").append(source)
            }
        } else {
            buildString {
                append("LAT  ").append(String.format(Locale.US, "%.6f", p.latitude))
                append("\nLON  ").append(String.format(Locale.US, "%.6f", p.longitude))
                p.altitudeMeters?.let { append("\nALT  ").append(String.format(Locale.US, "%.0f m", it)) }
                p.headingDegrees?.let { append("\nHDG  ").append(String.format(Locale.US, "%.1f°T", it)) }
                p.groundSpeedMps?.let { append("\nGS   ").append(String.format(Locale.US, "%.1f kt", it * 1.9438444924)) }
                p.pitchDegrees?.let { append("\nPIT  ").append(String.format(Locale.US, "%.1f°", it)) }
                p.rollDegrees?.let { append("\nROL  ").append(String.format(Locale.US, "%.1f°", it)) }
                if (mode.isNotBlank()) append("\nMODE ").append(mode)
                val source = SimulatorLocationStore.getSourceAddress()
                if (source.isNotBlank()) append("\nSRC  ").append(source)
                SimulatorLocationStore.getLastPacketAgeMillis()?.let {
                    append("\nAGE  ").append(String.format(Locale.US, "%.1f s", it / 1000.0))
                }
            }
        }
    }

    private fun buildBridgeGuide(defaultPort: Int): String {
        val bridgeName = if (selectedType == SimulatorLocationStore.TYPE_MSFS) "MSFS" else "Prepar3D"
        return "$bridgeName uses the JEPPIRAN Windows bridge already included in the project. " +
            "Run the matching bridge on the simulator PC and send to this device IP: ${localIpAddress()} on UDP $defaultPort."
    }

    private fun step(number: String, text: String): TextView = TextView(this).apply {
        this.text = "$number   $text"
        textSize = 13f
        setTextColor(textColor())
        setPadding(0, 5.dp, 0, 5.dp)
    }

    private fun sectionTitle(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 12f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(secondaryTextColor())
        setPadding(2.dp, 18.dp, 2.dp, 8.dp)
    }

    private fun roundedSurface() = android.graphics.drawable.GradientDrawable().apply {
        cornerRadius = 14.dp.toFloat()
        setColor(getColor(R.color.jeppiran_surface))
        setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
    }

    private fun lp(height: Int, l: Int = 0, t: Int = 4, r: Int = 0, b: Int = 4) =
        LinearLayout.LayoutParams(-1, height.dp).apply { setMargins(l.dp, t.dp, r.dp, b.dp) }

    private fun lpWrap(l: Int = 0, t: Int = 4, r: Int = 0, b: Int = 4) =
        LinearLayout.LayoutParams(-1, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            setMargins(l.dp, t.dp, r.dp, b.dp)
        }

    private fun textColor(): Int = getColor(R.color.jeppiran_text)
    private fun secondaryTextColor(): Int = getColor(R.color.jeppiran_text_secondary)
    private fun accentColor(): Int = Color.rgb(47, 217, 255)

    private fun localIpAddress(): String {
        return try {
            Collections.list(NetworkInterface.getNetworkInterfaces())
                .flatMap { Collections.list(it.inetAddresses) }
                .firstOrNull {
                    it is Inet4Address && !it.isLoopbackAddress && !it.isLinkLocalAddress
                }
                ?.hostAddress ?: "Unavailable"
        } catch (_: Throwable) {
            "Unavailable"
        }
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()
}
